//! Event classification. The kernel routes on the header alone; it never parses a
//! payload to decide what an event means.

use vlo_types::{Cause, EventInput, Kind, Status, START_STEP_ID};

use crate::error::{code, err_step, KResult};

/// Step id of the run-level cancel marker.
pub const CANCEL_STEP_ID: &str = "cancel";
/// Step id of the nondeterminism marker written by the re-fold check.
pub const NONDETERMINISM_STEP_ID: &str = "nondeterminism";
/// Step id of the marker the host writes when a reducer throws (`WorkflowFailure`).
pub const FAIL_STEP_ID: &str = "fail";
/// Step id of the marker a `complete` command writes.
pub const COMPLETE_STEP_ID: &str = "complete";
/// Step id of the marker a `continue_as_new` command writes.
pub const CONTINUE_STEP_ID: &str = "continue";
/// Suffix of the deadline timer an `await_signal` with `timeout_ms` reserves beside its
/// signal step: signal `x` races timer `x:timeout`. Whichever settles first closes the
/// other as `cancelled`, so the reducer only ever sees the winner.
pub const TIMEOUT_SUFFIX: &str = ":timeout";

/// Step id of the deadline timer paired with signal step `step_id`.
pub fn timeout_step_id(step_id: &str) -> String {
    format!("{step_id}{TIMEOUT_SUFFIX}")
}

/// The signal step a `<id>:timeout` timer is paired with, or `None` when `step_id` does
/// not carry the suffix. The caller still checks that a signal step of that id is open.
pub fn timeout_owner(step_id: &str) -> Option<&str> {
    step_id
        .strip_suffix(TIMEOUT_SUFFIX)
        .filter(|owner| !owner.is_empty())
}

/// How `prepare_event` routes an event, decided from the header alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Class {
    /// The run's first event. Calls `init(input)` then `on.started`.
    Started,
    /// Terminal task result: `succeeded` or `failed`.
    TaskResult,
    /// Worker accepted the push.
    TaskRunning,
    /// Host planned a retry; the step goes back to `scheduled` on the next attempt.
    TaskRetrying,
    /// The host cancelled the task (lifecycle only).
    TaskCancelled,
    /// A timer step fired.
    TimerFired,
    /// A signal reached a parked step.
    SignalDelivered,
    /// A child run reached a terminal status.
    ChildDone,
    /// The `cancel` marker: the user cancelled the run.
    UserCancel,
    /// The reducer threw; the host reports the failure rather than folding it.
    RunFailed,
    /// The `nondeterminism` marker: a re-fold diverged, so the run fails.
    NondeterminismDetected,
}

impl Class {
    /// Whether this class calls the reducer. The rest are pure bookkeeping.
    pub fn is_reduce(self) -> bool {
        matches!(
            self,
            Class::Started
                | Class::TaskResult
                | Class::TimerFired
                | Class::SignalDelivered
                | Class::ChildDone
        )
    }
}

/// Route an event by `kind`, `status` and, for markers, `step_id`.
///
/// Errors with `invalid_event` for a combination the kernel has no route for.
pub fn classify(event: &EventInput) -> KResult<Class> {
    let invalid = |what: &str| {
        Err(err_step(
            code::INVALID_EVENT,
            format!("{what}: kind={:?} status={:?}", event.kind, event.status),
            &event.step_id,
        ))
    };

    match event.kind {
        Kind::Marker => match event.step_id.as_str() {
            START_STEP_ID if event.status == Status::Succeeded => Ok(Class::Started),
            CANCEL_STEP_ID => Ok(Class::UserCancel),
            FAIL_STEP_ID if event.status == Status::Failed => Ok(Class::RunFailed),
            NONDETERMINISM_STEP_ID if event.cause == Some(Cause::NondeterminismDetected) => {
                Ok(Class::NondeterminismDetected)
            }
            _ => invalid("unroutable marker"),
        },
        Kind::Task => match event.status {
            Status::Succeeded | Status::Failed => Ok(Class::TaskResult),
            Status::Running => Ok(Class::TaskRunning),
            Status::Retrying => Ok(Class::TaskRetrying),
            Status::Cancelled => Ok(Class::TaskCancelled),
            _ => invalid("task events never carry this status"),
        },
        Kind::Timer => match event.status {
            Status::Succeeded => Ok(Class::TimerFired),
            _ => invalid("timer events only fire with status succeeded"),
        },
        Kind::Signal => match event.status {
            Status::Succeeded => Ok(Class::SignalDelivered),
            _ => invalid("signal events only arrive with status succeeded"),
        },
        Kind::Child => match event.status {
            Status::Succeeded | Status::Failed | Status::Cancelled => Ok(Class::ChildDone),
            _ => invalid("child events only carry a terminal status"),
        },
    }
}
