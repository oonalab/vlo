//! Envelope construction shared by `prepare` and `reduce`.
//!
//! Lifecycle events (`task/scheduled`, `timer/scheduled`, …) inherit `ts_ms` and
//! `random` from the trigger event: they are consequences of the same transition, and
//! re-using the trigger's values keeps a replay byte-identical.

use vlo_types::{Envelope, EventInput, Kind, RunRef, Status};

/// The default user state a lifecycle transition echoes when the run has no checkpoint
/// yet (only reachable before `started` has been folded).
pub const EMPTY_STATE: &str = "null";

/// The parts of a lifecycle event that differ from the trigger.
pub struct LifecycleEvent<'a> {
    pub step_id: &'a str,
    pub attempt: u32,
    pub kind: Kind,
    pub status: Status,
    pub schema_ref: Option<String>,
    pub payload: Option<String>,
}

/// Build the `EventInput` of a lifecycle event from the trigger's `ts_ms` / `random`.
pub fn lifecycle_input(
    run_id: &str,
    ts_ms: u64,
    random: &str,
    event: LifecycleEvent<'_>,
) -> EventInput {
    EventInput {
        run_id: run_id.to_string(),
        step_id: event.step_id.to_string(),
        attempt: event.attempt,
        kind: event.kind,
        status: event.status,
        cause: None,
        usage: None,
        ts_ms,
        random: random.to_string(),
        schema_ref: event.schema_ref,
        payload: event.payload,
        payload_ref: None,
        error: None,
    }
}

/// Seal an `EventInput` into a journaled `Envelope`. `state_hash` is stamped later,
/// once the whole transition is known, because every event in one transition carries
/// the hash of the state that transition produced.
pub fn envelope(input: EventInput, seq: u64, run: &RunRef) -> Envelope {
    Envelope {
        input,
        seq,
        parent_run_id: run.parent_run_id.clone(),
        parent_step_id: run.parent_step_id.clone(),
        state_hash: String::new(),
    }
}
