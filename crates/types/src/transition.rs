//! The write-set a transition produces, and the rows it is built from.
//!
//! A journal applies a [`Transition`] atomically under the run lock and never interprets
//! commands itself (see `docs/journal.md`).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{Envelope, KernelState, RetryPolicy, RunStatus, Status};

/// The run row as the host loaded it under the per-run lock.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RunRef {
    /// Run identifier.
    pub run_id: String,
    /// Workflow name the run executes.
    pub workflow: String,
    /// Content digest of the workflow bundle the run is pinned to.
    pub bundle_digest: String,
    /// Run-level status.
    pub status: RunStatus,
    /// Seq of the last journaled event; `0` before `started`.
    pub last_seq: u64,
    /// The parent run, when this run was spawned as a child.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_run_id: Option<String>,
    /// The parent's `spawn` step, when this run was spawned as a child.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_step_id: Option<String>,
}

/// The run-row columns a transition rewrites.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RunPatch {
    /// New run status.
    pub status: RunStatus,
    /// New `last_seq`: the seq of the last event in `Transition::events`.
    pub last_seq: u64,
}

/// A task row to insert. It doubles as the outbox entry the host pushes to a worker.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct NewTask {
    /// `<run_id>:<step_id>`.
    pub task_id: String,
    /// The step that owns the task.
    pub step_id: String,
    /// Always `1` for a new task.
    pub attempt: u32,
    /// Activity name the worker dispatches on.
    pub activity: String,
    /// Queue the task is pushed to.
    pub queue: String,
    /// Input schema reference, when the reducer named one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_ref: Option<String>,
    /// Activity input.
    pub input: Value,
    /// `<run_id>:<step_id>:<attempt>`; unique per dispatch attempt.
    pub idempotency_key: String,
    /// Retry policy resolved for this task.
    pub retry: RetryPolicy,
    /// Lease duration in milliseconds before the reaper may re-dispatch.
    pub lease_ttl_ms: u64,
    /// Per-attempt wall-clock budget in milliseconds; `None` means no budget.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeout_ms: Option<u64>,
}

/// A status change on an existing task row.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct TaskUpdate {
    /// `<run_id>:<step_id>`.
    pub task_id: String,
    /// The attempt the update applies to.
    pub attempt: u32,
    /// New task status.
    pub status: Status,
    /// For `retrying → scheduled`: the earliest dispatch time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub not_before_ms: Option<u64>,
}

/// A timer row to insert.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct NewTimer {
    /// The step that owns the timer.
    pub step_id: String,
    /// Absolute fire time in milliseconds since the Unix epoch.
    pub fire_at_ms: u64,
}

/// A child run to create.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct NewSpawn {
    /// The parent's step that owns the child.
    pub step_id: String,
    /// Deterministic child run id (see `derive_ids`).
    pub child_run_id: String,
    /// Workflow name of the child.
    pub workflow: String,
    /// Child run input.
    pub input: Value,
}

/// An open `await_signal` step the host registers so a matching signal can be delivered.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct SignalWait {
    /// The step that is waiting.
    pub step_id: String,
    /// Signal name.
    pub name: String,
    /// Payload schema reference, when the reducer named one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_ref: Option<String>,
    /// Absolute expiry in milliseconds since the Unix epoch; `None` waits forever.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_ms: Option<u64>,
}

/// A side-channel emission. Never journaled.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Emit {
    /// Channel name.
    pub channel: String,
    /// Payload.
    pub data: Value,
}

/// The run's terminal outcome.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Completion {
    /// `completed` or `continued`.
    pub status: RunStatus,
    /// Workflow output for `completed`; `None` for `continued`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<Value>,
}

/// Input for the successor run when the reducer issued `continue_as_new`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ContinueAsNew {
    /// Input for the successor run.
    pub input: Value,
}

/// The write-set. Journals apply it atomically under the run lock and never interpret
/// commands themselves (see `docs/journal.md`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Transition {
    /// Run-row patch.
    pub run: RunPatch,
    /// Kernel state after the transition.
    pub kernel_state: KernelState,
    /// User state, byte-exact JSON. Stored inline when `state_inline`, else offloaded.
    pub state: String,
    /// Hash of `(kernel_state, state)` (see `docs/kernel-protocol.md`).
    pub state_hash: String,
    /// Whether `state` fits the inline limit (`INLINE_LIMIT_BYTES`).
    pub state_inline: bool,
    /// Trigger event first, then lifecycle `scheduled` events for each new task/timer/spawn/wait.
    pub events: Vec<Envelope>,
    /// Task rows to insert.
    #[serde(default)]
    pub tasks: Vec<NewTask>,
    /// Status changes to existing task rows.
    #[serde(default)]
    pub task_updates: Vec<TaskUpdate>,
    /// Timer rows to insert.
    #[serde(default)]
    pub timers: Vec<NewTimer>,
    /// Child runs to create.
    #[serde(default)]
    pub spawns: Vec<NewSpawn>,
    /// Signal waits to register.
    #[serde(default)]
    pub signal_waits: Vec<SignalWait>,
    /// Side-channel emissions to publish.
    #[serde(default)]
    pub emits: Vec<Emit>,
    /// Set when the run ended in this transition.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completion: Option<Completion>,
    /// Set when the run continues as a successor run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub continue_as_new: Option<ContinueAsNew>,
}
