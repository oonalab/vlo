//! `prepare_event`: decide what an incoming event means before any reducer runs.
//!
//! Three outcomes: reject it, fold it (the host calls the reducer, then `reduce_step`),
//! or apply it as pure bookkeeping (a lifecycle transition the host writes as-is).

use vlo_types::{
    EventInput, KernelState, Kind, PrepareEventInput, Prepared, ReducerEvent, RunRef, RunStatus,
    Status, TaskUpdate, Transition, Usage,
};

use crate::classify::{classify, Class};
use crate::error::{code, err, err_seq, err_step, KResult};
use crate::events::EMPTY_STATE;
use crate::guards::{
    check_attempt, check_legal, require_kernel_state, require_step, retry_delay_ms, set_status,
};
use crate::lifecycle::{self, LifecycleTransition};
use crate::validate::{optional_payload_value, payload_value, validate_event};
use crate::{ids, steps};

/// Classify an event and return either a reducer call or a lifecycle write-set.
///
/// Errors: `invalid_event` (validation, wrong run, missing `kernel_state`),
/// `run_closed`, `bad_seq` (`started` not at seq 1), `unknown_step`,
/// `illegal_transition`, `already_terminal`.
pub fn prepare_event(input: &PrepareEventInput) -> KResult<Prepared> {
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

    let class = classify(&event)?;
    let seq = run.last_seq + 1;

    match class {
        Class::Started => started(run, &event),
        Class::TaskResult => task_result(input, &event),
        Class::TaskRunning => task_running(input, &event, seq),
        Class::TaskRetrying => task_retrying(input, &event, seq),
        Class::TaskCancelled => task_cancelled(input, &event, seq),
        Class::TimerFired => timer_fired(input, &event),
        Class::SignalDelivered => signal_delivered(input, &event),
        Class::ChildDone => child_done(input, &event),
        Class::UserCancel => close_run(input, &event, seq, RunStatus::Cancelled),
        Class::RunFailed | Class::NondeterminismDetected => {
            close_run(input, &event, seq, RunStatus::Failed)
        }
    }
}

// ---------------------------------------------------------------- reduce outcomes

/// The run total the reducer will see: what is already banked plus this event's own usage.
/// `reduce_step` banks the same addition, so the two never disagree.
fn banked(kernel_state: &KernelState, event: &EventInput) -> Usage {
    let mut total = kernel_state.usage_total;
    if let Some(usage) = &event.usage {
        total.add(usage);
    }
    total
}

fn started(run: &RunRef, event: &EventInput) -> KResult<Prepared> {
    if run.last_seq != 0 {
        return Err(err_seq(
            code::BAD_SEQ,
            format!("started must be seq 1; run is at {}", run.last_seq),
            run.last_seq + 1,
        ));
    }
    if run.status != RunStatus::Created {
        return Err(err(
            code::ILLEGAL_TRANSITION,
            format!("started requires a created run; run is {:?}", run.status),
        ));
    }
    let workflow_input = payload_value(event)?;
    let mut kernel_state = KernelState::new();
    kernel_state.status = RunStatus::Running;

    let usage_total = banked(&kernel_state, event);
    Ok(Prepared::Reduce {
        reducer_event: ReducerEvent::Started {
            ts_ms: event.ts_ms,
            random: event.random.clone(),
            input: workflow_input.clone(),
            usage_total,
        },
        init_input: Some(workflow_input),
        kernel_state,
    })
}

fn task_result(input: &PrepareEventInput, event: &EventInput) -> KResult<Prepared> {
    let kernel_state = require_kernel_state(input)?;
    let step = require_step(kernel_state, event, Kind::Task)?;
    check_attempt(step, event)?;
    check_legal(step, event)?;

    let output = if event.status == Status::Succeeded {
        Some(payload_value(event)?)
    } else {
        None
    };

    Ok(Prepared::Reduce {
        reducer_event: ReducerEvent::TaskDone {
            ts_ms: event.ts_ms,
            random: event.random.clone(),
            step_id: event.step_id.clone(),
            attempt: event.attempt,
            activity: step.activity.clone().unwrap_or_default(),
            status: event.status,
            output,
            cause: event.cause,
            error: event.error.clone(),
            usage: event.usage.unwrap_or_default(),
            usage_total: banked(kernel_state, event),
        },
        init_input: None,
        kernel_state: kernel_state.clone(),
    })
}

/// A `<id>:timeout` deadline that fires first cancels the signal step it raced; the
/// reducer sees only the timer.
fn timer_fired(input: &PrepareEventInput, event: &EventInput) -> KResult<Prepared> {
    let mut kernel_state = require_kernel_state(input)?.clone();
    let step = require_step(&kernel_state, event, Kind::Timer)?;
    check_legal(step, event)?;
    steps::cancel_race_loser(&mut kernel_state, Kind::Timer, &event.step_id);

    Ok(Prepared::Reduce {
        reducer_event: ReducerEvent::Timer {
            ts_ms: event.ts_ms,
            random: event.random.clone(),
            step_id: event.step_id.clone(),
            usage_total: banked(&kernel_state, event),
        },
        init_input: None,
        kernel_state,
    })
}

/// A signal that lands first cancels its `<id>:timeout` deadline, if one is armed; the
/// reducer sees only the signal.
fn signal_delivered(input: &PrepareEventInput, event: &EventInput) -> KResult<Prepared> {
    let mut kernel_state = require_kernel_state(input)?.clone();
    let step = require_step(&kernel_state, event, Kind::Signal)?;
    if step.status != Status::AwaitingSignal {
        return Err(err_step(
            code::ILLEGAL_TRANSITION,
            format!("signal step is {:?}, not awaiting_signal", step.status),
            &event.step_id,
        ));
    }
    let name = step.signal.clone().unwrap_or_default();
    steps::cancel_race_loser(&mut kernel_state, Kind::Signal, &event.step_id);

    Ok(Prepared::Reduce {
        reducer_event: ReducerEvent::Signal {
            ts_ms: event.ts_ms,
            random: event.random.clone(),
            step_id: event.step_id.clone(),
            name,
            payload: payload_value(event)?,
            usage_total: banked(&kernel_state, event),
        },
        init_input: None,
        kernel_state,
    })
}

fn child_done(input: &PrepareEventInput, event: &EventInput) -> KResult<Prepared> {
    let kernel_state = require_kernel_state(input)?;
    let step = require_step(kernel_state, event, Kind::Child)?;
    check_legal(step, event)?;

    Ok(Prepared::Reduce {
        reducer_event: ReducerEvent::ChildDone {
            ts_ms: event.ts_ms,
            random: event.random.clone(),
            step_id: event.step_id.clone(),
            child_run_id: step.child_run_id.clone().unwrap_or_default(),
            status: event.status,
            output: optional_payload_value(event)?,
            usage_total: banked(kernel_state, event),
        },
        init_input: None,
        kernel_state: kernel_state.clone(),
    })
}

// ------------------------------------------------------------- lifecycle outcomes

fn task_running(input: &PrepareEventInput, event: &EventInput, seq: u64) -> KResult<Prepared> {
    let mut kernel_state = require_kernel_state(input)?.clone();
    let step = require_step(&kernel_state, event, Kind::Task)?;
    check_attempt(step, event)?;
    check_legal(step, event)?;

    let attempt = step.attempt;
    set_status(&mut kernel_state, &event.step_id, Status::Running);

    lifecycle(
        input,
        event,
        kernel_state,
        input.run.status,
        seq,
        vec![TaskUpdate {
            task_id: ids::task_id(&input.run.run_id, &event.step_id),
            attempt,
            status: Status::Running,
            not_before_ms: None,
        }],
    )
}

fn task_retrying(input: &PrepareEventInput, event: &EventInput, seq: u64) -> KResult<Prepared> {
    let mut kernel_state = require_kernel_state(input)?.clone();
    let step = require_step(&kernel_state, event, Kind::Task)?;
    check_legal(step, event)?;
    // `attempt` on a retry event names the *next* attempt.
    if event.attempt <= step.attempt {
        return Err(err_step(
            code::ALREADY_TERMINAL,
            format!(
                "retry names attempt {}, step is already at {}",
                event.attempt, step.attempt
            ),
            &event.step_id,
        ));
    }
    if event.attempt != step.attempt + 1 {
        return Err(err_step(
            code::ILLEGAL_TRANSITION,
            format!(
                "retry skips attempts: step {} → event {}",
                step.attempt, event.attempt
            ),
            &event.step_id,
        ));
    }

    let delay_ms = retry_delay_ms(event)?;
    if let Some(step) = kernel_state.steps.get_mut(&event.step_id) {
        step.status = Status::Scheduled;
        step.attempt = event.attempt;
    }

    lifecycle(
        input,
        event,
        kernel_state,
        input.run.status,
        seq,
        vec![TaskUpdate {
            task_id: ids::task_id(&input.run.run_id, &event.step_id),
            attempt: event.attempt,
            status: Status::Scheduled,
            not_before_ms: Some(event.ts_ms.saturating_add(delay_ms)),
        }],
    )
}

fn task_cancelled(input: &PrepareEventInput, event: &EventInput, seq: u64) -> KResult<Prepared> {
    let mut kernel_state = require_kernel_state(input)?.clone();
    let step = require_step(&kernel_state, event, Kind::Task)?;
    check_legal(step, event)?;
    let attempt = step.attempt;
    steps::close_step(&mut kernel_state, &event.step_id);

    lifecycle(
        input,
        event,
        kernel_state,
        input.run.status,
        seq,
        vec![TaskUpdate {
            task_id: ids::task_id(&input.run.run_id, &event.step_id),
            attempt,
            status: Status::Cancelled,
            not_before_ms: None,
        }],
    )
}

/// `user_cancel`, `fail` and `nondeterminism_detected` all end the run: every open step
/// is closed and every open task is told to stop, so no worker keeps running for a run
/// nobody will fold again.
fn close_run(
    input: &PrepareEventInput,
    event: &EventInput,
    seq: u64,
    status: RunStatus,
) -> KResult<Prepared> {
    let mut kernel_state = input.kernel_state.clone().unwrap_or_default();
    let task_updates = steps::close_open_steps(&mut kernel_state, &input.run.run_id);
    kernel_state.status = status;
    lifecycle(input, event, kernel_state, status, seq, task_updates)
}

fn lifecycle(
    input: &PrepareEventInput,
    event: &EventInput,
    mut kernel_state: KernelState,
    run_status: RunStatus,
    seq: u64,
    task_updates: Vec<TaskUpdate>,
) -> KResult<Prepared> {
    // A lifecycle event never reaches `reduce_step`, so this is where its usage is banked.
    // A retried attempt burned its tokens before it lost; the run still owes them.
    if let Some(usage) = &event.usage {
        kernel_state.usage_total.add(usage);
    }
    let state = input.state.as_deref().unwrap_or(EMPTY_STATE);
    let transition: Transition = lifecycle::build(
        event,
        LifecycleTransition {
            run: &input.run,
            kernel_state,
            state,
            run_status,
            seq,
            task_updates,
        },
    )?;
    Ok(Prepared::Lifecycle { transition })
}
