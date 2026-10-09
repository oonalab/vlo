//! Adapter traits for a Rust host (see `docs/journal.md`). Not yet used by any host —
//! the TypeScript host implements the same interfaces natively — but kept in sync so a
//! Rust host can reuse the same write-set contract.

#![deny(missing_docs)]

use vlo_types::{Envelope, KernelState, Transition};

/// The run's checkpoint: kernel state and user state after the transition at `seq`.
pub struct StateRow {
    /// Seq of the transition that wrote this row; always the run's `last_seq`.
    pub seq: u64,
    /// Bundle the state was produced by. A mismatch with the run's pin forces a fold from seq 0.
    pub bundle_digest: String,
    /// Kernel-owned bookkeeping.
    pub kernel_state: KernelState,
    /// User state, byte-exact JSON.
    pub state: String,
    /// Hash of `(kernel_state, state)`; verified on every load.
    pub state_hash: String,
}

/// Ordered, per-run journal. `apply_transition` is the only write path for history.
pub trait Journal {
    /// Adapter-specific failure.
    type Error;
    /// Events with `seq > since_seq`, ascending.
    fn read(&self, run_id: &str, since_seq: u64) -> Result<Vec<Envelope>, Self::Error>;
    /// The latest checkpoint, or `None` before the first transition was applied.
    fn get_state(&self, run_id: &str) -> Result<Option<StateRow>, Self::Error>;
    /// Apply one write-set atomically under the run lock.
    fn apply_transition(&self, run_id: &str, t: &Transition) -> Result<(), Self::Error>;
}

/// Content-addressed storage for payloads and state above the inline limit
/// (see `docs/limits.md`).
pub trait BlobStore {
    /// Adapter-specific failure.
    type Error;
    /// Store `bytes`; returns the lowercase hex sha256 that names them.
    fn put(&self, bytes: &[u8]) -> Result<String, Self::Error>;
    /// Fetch the bytes named by `sha256_hex`.
    fn get(&self, sha256_hex: &str) -> Result<Vec<u8>, Self::Error>;
}

/// Delivers tasks to workers. HTTP push is the reference implementation.
pub trait TaskTransport {
    /// Adapter-specific failure.
    type Error;
    /// Deliver one task; `Ok(true)` when the worker accepted it (202).
    fn push(&self, queue: &str, task_json: &str) -> Result<bool, Self::Error>;
}
