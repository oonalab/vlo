//! Operations on `KernelState::steps`.
//!
//! Terminal steps are pruned rather than kept with a terminal status, so the map stays
//! bounded on long runs; `closed_steps` carries the count. A later event for a pruned
//! step therefore reports `unknown_step`, which is exactly the answer a late duplicate
//! result deserves.

use vlo_types::{KernelState, Kind, Status, StepState, TaskUpdate};

use crate::classify::{timeout_owner, timeout_step_id};
use crate::ids;

/// Prune one step and account for it.
pub fn close_step(kernel_state: &mut KernelState, step_id: &str) -> Option<StepState> {
    let step = kernel_state.steps.remove(step_id)?;
    kernel_state.closed_steps = kernel_state.closed_steps.saturating_add(1);
    Some(step)
}

/// Close every open step and emit a `cancelled` task update for each open task, so the
/// host releases leases instead of leaving workers running for a dead run.
pub fn close_open_steps(kernel_state: &mut KernelState, run_id: &str) -> Vec<TaskUpdate> {
    let open: Vec<(String, StepState)> = kernel_state
        .steps
        .iter()
        .map(|(id, step)| (id.clone(), step.clone()))
        .collect();

    let mut updates = Vec::new();
    for (step_id, step) in &open {
        if step.kind == Kind::Task {
            updates.push(TaskUpdate {
                task_id: ids::task_id(run_id, step_id),
                attempt: step.attempt,
                status: Status::Cancelled,
                not_before_ms: None,
            });
        }
    }
    kernel_state.closed_steps = kernel_state.closed_steps.saturating_add(open.len() as u64);
    kernel_state.steps.clear();
    updates
}

/// Whether the timer `timer_id` is the `<id>:timeout` deadline of a signal step that is
/// still awaiting its signal.
fn is_signal_deadline(kernel_state: &KernelState, timer_id: &str) -> bool {
    timeout_owner(timer_id).is_some_and(|owner| {
        kernel_state
            .steps
            .get(owner)
            .is_some_and(|step| step.kind == Kind::Signal && step.status == Status::AwaitingSignal)
    })
}

/// When a signal step or its `<id>:timeout` deadline timer settles, close the other side
/// of the race as `cancelled` so the reducer only ever sees the winner. Timers are not
/// tasks, so no task update is owed; the loser is pruned like any other terminal step,
/// and a late event for it reports `unknown_step`.
pub fn cancel_race_loser(kernel_state: &mut KernelState, kind: Kind, step_id: &str) {
    let loser = match kind {
        Kind::Signal => {
            let timer_id = timeout_step_id(step_id);
            let scheduled = kernel_state
                .steps
                .get(&timer_id)
                .is_some_and(|step| step.kind == Kind::Timer && step.status == Status::Scheduled);
            scheduled.then_some(timer_id)
        }
        Kind::Timer if is_signal_deadline(kernel_state, step_id) => {
            timeout_owner(step_id).map(str::to_string)
        }
        _ => None,
    };
    if let Some(loser) = loser {
        close_step(kernel_state, &loser);
    }
}

/// Whether any open step can still produce work (task / timer / child). A deadline timer
/// paired with an open signal step belongs to that wait, so it does not count: the run is
/// parked on the signal, deadline or not.
pub fn has_open_work(kernel_state: &KernelState) -> bool {
    kernel_state.steps.iter().any(|(id, step)| match step.kind {
        Kind::Task | Kind::Child => true,
        Kind::Timer => !is_signal_deadline(kernel_state, id),
        Kind::Signal | Kind::Marker => false,
    })
}

/// Whether the run is parked on at least one signal.
pub fn has_open_signal(kernel_state: &KernelState) -> bool {
    kernel_state
        .steps
        .values()
        .any(|step| step.kind == Kind::Signal)
}
