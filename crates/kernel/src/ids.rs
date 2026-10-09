//! Deterministic identifier derivation. Every id a run produces is a pure function of
//! `(run_id, step_id, attempt)`, which is what makes task dispatch idempotent across
//! crashes and re-pushes.

use vlo_types::{DeriveIdsInput, DeriveIdsOutput};

use crate::hash::sha256_hex;

/// Child run ids are opaque and fixed-width so they fit the same column as host-minted ids.
const CHILD_RUN_ID_HEX_LEN: usize = 26;

/// `<run_id>:<step_id>`; stable across attempts.
pub fn task_id(run_id: &str, step_id: &str) -> String {
    format!("{run_id}:{step_id}")
}

/// `<run_id>:<step_id>:<attempt>`; unique per dispatch attempt.
pub fn idempotency_key(run_id: &str, step_id: &str, attempt: u32) -> String {
    format!("{run_id}:{step_id}:{attempt}")
}

/// `run_` followed by the first 26 hex chars of `sha256(task_id)`.
pub fn child_run_id(run_id: &str, step_id: &str) -> String {
    let digest = sha256_hex(task_id(run_id, step_id).as_bytes());
    format!("run_{}", &digest[..CHILD_RUN_ID_HEX_LEN])
}

/// All three ids for one `(run_id, step_id, attempt)`.
pub fn derive_ids(input: &DeriveIdsInput) -> DeriveIdsOutput {
    DeriveIdsOutput {
        task_id: task_id(&input.run_id, &input.step_id),
        idempotency_key: idempotency_key(&input.run_id, &input.step_id, input.attempt),
        child_run_id: child_run_id(&input.run_id, &input.step_id),
    }
}
