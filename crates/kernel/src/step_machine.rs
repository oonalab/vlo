//! The step state machine (see `docs/kernel-protocol.md`).
//!
//! The diagram's edges, plus two that fall out of how work actually lands:
//! - `scheduled → succeeded|failed`: a worker may return a result inline, before the
//!   host ever records `running`.
//! - `retrying → succeeded|failed`: the same for a result that beats the reschedule.
//!
//! Terminal statuses have no outgoing edges; the kernel prunes terminal steps from
//! `KernelState::steps`, so a later event for one reports `unknown_step`.

use vlo_types::Status;

/// Every status, in declaration order. Used by the exhaustive legality test.
pub const ALL_STATUSES: [Status; 7] = [
    Status::Scheduled,
    Status::Running,
    Status::Succeeded,
    Status::Failed,
    Status::Retrying,
    Status::Cancelled,
    Status::AwaitingSignal,
];

/// Whether `from → to` is an edge of the step state machine.
pub fn is_legal(from: Status, to: Status) -> bool {
    use Status::*;
    matches!(
        (from, to),
        (Scheduled, Running)
            | (Scheduled, Succeeded)
            | (Scheduled, Failed)
            | (Scheduled, Retrying)
            | (Scheduled, Cancelled)
            | (Running, Succeeded)
            | (Running, Failed)
            | (Running, Retrying)
            | (Running, Cancelled)
            | (Running, AwaitingSignal)
            | (Retrying, Scheduled)
            | (Retrying, Succeeded)
            | (Retrying, Failed)
            | (Retrying, Cancelled)
            | (AwaitingSignal, Running)
            | (AwaitingSignal, Succeeded)
            | (AwaitingSignal, Cancelled)
    )
}
