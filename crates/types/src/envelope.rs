//! The event envelope: kinds, statuses, causes, usage, and the journaled event shape.
//!
//! The kernel routes on the header fields alone and never parses `payload`
//! (see `docs/kernel-protocol.md`).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// The five event kinds. Projects cannot add kinds (see `docs/kernel-protocol.md`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    /// An activity executed by a worker.
    Task,
    /// A durable timer the host fires at `fire_at_ms`.
    Timer,
    /// An external signal delivered to a parked `await_signal` step.
    Signal,
    /// A child run spawned by this run.
    Child,
    /// Kernel bookkeeping: `start`, `cancel`, `fail`, `complete`, `continue`, `nondeterminism`.
    Marker,
}

/// The seven step statuses (see `docs/kernel-protocol.md`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// Opened, not yet accepted by a worker (timers, children and markers start here too).
    Scheduled,
    /// A worker accepted the task.
    Running,
    /// Terminal: the step produced a result.
    Succeeded,
    /// Terminal: non-retryable cause, attempts exhausted, or `schema_violation`.
    Failed,
    /// A retry was planned; the step returns to `scheduled` for the next attempt.
    Retrying,
    /// Terminal: cancelled by the run or by the user.
    Cancelled,
    /// Parked until a signal is delivered.
    AwaitingSignal,
}

impl Status {
    /// `true` for `succeeded`, `failed` and `cancelled`: the statuses with no outgoing edge.
    pub fn is_terminal(self) -> bool {
        matches!(self, Status::Succeeded | Status::Failed | Status::Cancelled)
    }
}

/// Failure taxonomy. Retry policy is keyed on this, never on application error text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Cause {
    /// The attempt exceeded its wall-clock budget (`timeout_ms`). Retryable.
    Timeout,
    /// The worker stopped heartbeating and its lease expired. Retryable.
    HeartbeatLost,
    /// The activity threw. Retryable.
    AppError,
    /// The user cancelled the run. Never retried.
    UserCancel,
    /// The worker's output failed schema validation. Never retried.
    SchemaViolation,
    /// A re-fold diverged from the journal. Never retried.
    NondeterminismDetected,
}

/// Resource usage stamped on events and summed into `KernelState`. Integers only,
/// because `KernelState` is hashed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
pub struct Usage {
    /// CPU time consumed, in milliseconds.
    #[serde(default)]
    pub cpu_ms: u64,
    /// Model tokens consumed.
    #[serde(default)]
    pub tokens: u64,
    /// Cost in micro-USD (1 USD = 1_000_000). Integer so the hash stays float-free.
    #[serde(default)]
    pub cost_micro_usd: u64,
}

impl Usage {
    /// Add `other` into `self`, saturating on overflow.
    pub fn add(&mut self, other: &Usage) {
        self.cpu_ms = self.cpu_ms.saturating_add(other.cpu_ms);
        self.tokens = self.tokens.saturating_add(other.tokens);
        self.cost_micro_usd = self.cost_micro_usd.saturating_add(other.cost_micro_usd);
    }
}

/// An event as the host submits it, before the kernel assigns `seq` and `state_hash`.
///
/// `random` is 32 hex chars of host-generated randomness, journaled so that every
/// consumer of randomness (retry jitter, reducer `random`) is replay-stable.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct EventInput {
    /// The run this event belongs to.
    pub run_id: String,
    /// The step this event belongs to; `start` for the `started` marker.
    pub step_id: String,
    /// Task attempt this event is about (1-based); a `retrying` event names the *next*
    /// attempt. `0` for every other kind.
    #[serde(default)]
    pub attempt: u32,
    /// Event kind; the kernel routes on `kind`, `status` and `step_id`.
    pub kind: Kind,
    /// The step status this event moves the step to.
    pub status: Status,
    /// Failure cause on `failed` / `retrying` events; `None` otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cause: Option<Cause>,
    /// Resources this event consumed; banked into `KernelState::usage_total`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    /// Host wall-clock at submission, in milliseconds since the Unix epoch. The reducer's
    /// only clock.
    pub ts_ms: u64,
    /// 32 lowercase hex chars of host-generated randomness, journaled for replay.
    pub random: String,
    /// Schema the payload conforms to (`<name>@<content-hash>`), when known.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_ref: Option<String>,
    /// Inline JSON payload, byte-exact. Exactly one of `payload` / `payload_ref` may be set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload: Option<String>,
    /// `blob://sha256/<hex>` when the payload was offloaded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_ref: Option<String>,
    /// Free-text error detail for `failed` task events. Never interpreted by the kernel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A journaled event: `EventInput` plus the kernel-assigned sequence number and the
/// state hash after folding it (so a re-fold can pinpoint the divergent seq).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Envelope {
    /// The submitted event, flattened into the envelope on the wire.
    #[serde(flatten)]
    pub input: EventInput,
    /// Sequence number assigned by the journal writer; strictly increasing per run,
    /// starting at `1`.
    pub seq: u64,
    /// The parent run, when this run was spawned as a child.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_run_id: Option<String>,
    /// The parent's `spawn` step, when this run was spawned as a child.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_step_id: Option<String>,
    /// Hash of `(kernel_state, state)` after the transition that produced this event
    /// (see `docs/kernel-protocol.md`).
    pub state_hash: String,
}

/// Well-known step id of the `started` marker event.
pub const START_STEP_ID: &str = "start";
