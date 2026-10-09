//! `reduce_step`: turn a reducer's `(state, commands)` into the transition write-set.
//!
//! The kernel does not trust the reducer. Every command is validated, every step id is
//! checked for collision, and the run's own status is derived from the resulting step
//! map rather than from anything the reducer claimed.

use vlo_types::{
    Command, EventInput, KernelState, Kind, ReduceStepInput, RunStatus, TaskUpdate, Transition,
    INLINE_LIMIT_BYTES,
};

use crate::classify::{classify, Class};
use crate::commands::Builder;
use crate::error::{code, err, err_step, KResult};
use crate::validate::validate_event;
use crate::{canonical, hash, ids, steps};

/// Build the write-set for one reducer call (see `docs/workflows.md`).
///
/// Validates the event, retires the trigger's step and banks its usage, applies each
/// command in order, then derives the run status from the open steps. Errors:
/// `invalid_event`, `run_closed`, `malformed_json` (reducer state), `unknown_step`, and
/// the command codes (`invalid_command`, `duplicate_step_id`, `multiple_completions`,
/// `commands_after_completion`).
pub fn reduce_step(input: &ReduceStepInput) -> KResult<Transition> {
    let event = validate_event(&input.event)?;
    let run = &input.run;
    if event.run_id != run.run_id {
        return Err(err(
            code::INVALID_EVENT,
            format!("event run_id {} is not run {}", event.run_id, run.run_id),
        ));
    }
    if run.status.is_terminal() {
        return Err(err(
            code::RUN_CLOSED,
            format!("run is {:?}; no further events are accepted", run.status),
        ));
    }
    // The reducer's state must be JSON: it is hashed and replayed.
    canonical::parse(&input.reduction.state)?;

    let class = classify(&event)?;
    if !class.is_reduce() {
        return Err(err_step(
            code::INVALID_EVENT,
            "this event is lifecycle-only; apply the transition from prepare_event",
            &event.step_id,
        ));
    }

    let mut kernel_state = input.kernel_state.clone();
    apply_trigger(&mut kernel_state, class, &event)?;

    let mut builder = Builder::new(run, kernel_state, event.ts_ms, &event.random);
    builder.push_event(event.clone());
    // A task result also settles its row: the journal closes it (status, lease) in the same
    // write-set, so `expiredLeases` and the outbox never see a finished task again.
    if class == Class::TaskResult {
        builder.task_updates.push(TaskUpdate {
            task_id: ids::task_id(&run.run_id, &event.step_id),
            attempt: event.attempt,
            status: event.status,
            not_before_ms: None,
        });
    }

    for command in &input.reduction.commands {
        if builder.completion.is_some() {
            return Err(completion_conflict(command));
        }
        builder.apply(command)?;
    }

    let run_status = finalize(&mut builder);
    let state = input.reduction.state.clone();
    let state_hash = hash::state_hash(&builder.kernel_state, &state)?;
    let state_inline = state.len() <= INLINE_LIMIT_BYTES;
    Ok(builder.finish(state, state_hash, state_inline, run_status))
}

/// Retire the step the trigger event belongs to and bank its usage. A signal or its
/// `<id>:timeout` deadline also retires the other side of the race; `prepare_event`
/// already did so in the kernel state it handed back, so this is a no-op on the happy
/// path and a guarantee when the host folds from its own checkpoint.
fn apply_trigger(kernel_state: &mut KernelState, class: Class, event: &EventInput) -> KResult<()> {
    if class == Class::Started {
        kernel_state.status = RunStatus::Running;
    } else if steps::close_step(kernel_state, &event.step_id).is_none() {
        return Err(err_step(
            code::UNKNOWN_STEP,
            "no open step with this id",
            &event.step_id,
        ));
    }
    match class {
        Class::SignalDelivered => {
            steps::cancel_race_loser(kernel_state, Kind::Signal, &event.step_id)
        }
        Class::TimerFired => steps::cancel_race_loser(kernel_state, Kind::Timer, &event.step_id),
        _ => {}
    }
    if let Some(usage) = &event.usage {
        kernel_state.usage_total.add(usage);
    }
    Ok(())
}

/// Settle the run status, closing anything still open once the reducer has completed.
fn finalize(builder: &mut Builder<'_>) -> RunStatus {
    if let Some(completion) = &builder.completion {
        let status = completion.status;
        let run_id = builder.run.run_id.clone();
        let mut cancelled = steps::close_open_steps(&mut builder.kernel_state, &run_id);
        builder.task_updates.append(&mut cancelled);
        builder.kernel_state.status = status;
        return status;
    }
    let status = if steps::has_open_signal(&builder.kernel_state)
        && !steps::has_open_work(&builder.kernel_state)
    {
        RunStatus::AwaitingSignal
    } else {
        RunStatus::Running
    };
    builder.kernel_state.status = status;
    status
}

fn completion_conflict(command: &Command) -> vlo_types::KernelError {
    match command {
        Command::Complete { .. } | Command::ContinueAsNew { .. } => err(
            code::MULTIPLE_COMPLETIONS,
            "a reduction may complete or continue a run at most once",
        ),
        _ => err(
            code::COMMANDS_AFTER_COMPLETION,
            "no command may follow complete / continue_as_new",
        ),
    }
}
