//! Inputs and outputs of the eight kernel exports (see `docs/kernel-protocol.md`).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{Cause, EventInput, KernelState, Reduction, RunRef, Status, Transition, Usage};

/// Output of `kernel_version`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct KernelVersion {
    /// Crate version of the kernel.
    pub version: String,
    /// Protocol version; the host refuses a kernel whose value differs from its own.
    pub protocol: u32,
    /// Feature names the host may branch on. Additive only.
    pub features: Vec<String>,
}

/// Every export returns this shape: `{"ok":true,"value":…}` or `{"ok":false,"error":…}`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct KernelResult<T> {
    /// `true` when `value` is set, `false` when `error` is.
    pub ok: bool,
    /// The export's output when `ok`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<T>,
    /// The failure when not `ok`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<KernelError>,
}

impl<T> KernelResult<T> {
    /// Wrap a successful value.
    pub fn ok(value: T) -> Self {
        KernelResult {
            ok: true,
            value: Some(value),
            error: None,
        }
    }
    /// Wrap a failure.
    pub fn err(error: KernelError) -> Self {
        KernelResult {
            ok: false,
            value: None,
            error: Some(error),
        }
    }
}

/// A kernel failure. `code` is one of the closed set the kernel defines; the host
/// branches on it, never on `message`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct KernelError {
    /// Machine-readable code, e.g. `invalid_event`.
    pub code: String,
    /// Human-readable detail. Not stable; never branch on it.
    pub message: String,
    /// The seq the failure concerns, when it concerns one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seq: Option<u64>,
    /// The step the failure concerns, when it concerns one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step_id: Option<String>,
}

/// Output of `validate_event`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ValidateEventOutput {
    /// The event after validation; currently a byte-exact copy of the input.
    pub normalized: EventInput,
}

/// Input to `prepare_event`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct PrepareEventInput {
    /// The run row as loaded under the run lock.
    pub run: RunRef,
    /// `None` only for the `started` event.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kernel_state: Option<KernelState>,
    /// The current user-state checkpoint, byte-exact. Lifecycle transitions echo it and
    /// hash it without calling the reducer, so the host must pass it for any event that
    /// is not `started`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    /// The event to prepare.
    pub event: EventInput,
}

/// What the reducer sees. The kernel translates journal headers into these; the
/// reducer never sees `seq`, `random` or lifecycle noise except where it needs them.
///
/// `usage_total` rides on every variant: it is the run's banked total *including* this
/// event, so a reducer can decide on a budget without keeping its own tally
/// (see `docs/workflows.md`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReducerEvent {
    /// The run's first event, delivered right after `init(input)`.
    Started {
        /// Event time in milliseconds since the Unix epoch; the reducer's clock.
        ts_ms: u64,
        /// 32 hex chars of journaled randomness; the reducer's only entropy.
        random: String,
        /// Workflow input.
        input: Value,
        /// Banked usage for the run, including this event.
        #[serde(default)]
        usage_total: Usage,
    },
    /// A task reached `succeeded` or `failed`.
    TaskDone {
        /// Event time in milliseconds since the Unix epoch; the reducer's clock.
        ts_ms: u64,
        /// 32 hex chars of journaled randomness; the reducer's only entropy.
        random: String,
        /// The step that finished.
        step_id: String,
        /// The attempt that finished (1-based).
        attempt: u32,
        /// Activity name recorded on the step.
        activity: String,
        /// `succeeded` or `failed`.
        status: Status,
        /// Worker output on `succeeded`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output: Option<Value>,
        /// Failure cause on `failed`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        cause: Option<Cause>,
        /// Free-text error detail on `failed`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<String>,
        /// What this attempt itself consumed; zeroed when the worker reported none.
        #[serde(default)]
        usage: Usage,
        /// Banked usage for the run, including this event.
        #[serde(default)]
        usage_total: Usage,
    },
    /// A signal was delivered to a parked step.
    Signal {
        /// Event time in milliseconds since the Unix epoch; the reducer's clock.
        ts_ms: u64,
        /// 32 hex chars of journaled randomness; the reducer's only entropy.
        random: String,
        /// The step that was waiting.
        step_id: String,
        /// Signal name recorded on the step.
        name: String,
        /// Signal payload; JSON `null` when the event carried none.
        payload: Value,
        /// Banked usage for the run, including this event.
        #[serde(default)]
        usage_total: Usage,
    },
    /// A timer fired.
    Timer {
        /// Event time in milliseconds since the Unix epoch; the reducer's clock.
        ts_ms: u64,
        /// 32 hex chars of journaled randomness; the reducer's only entropy.
        random: String,
        /// The timer step.
        step_id: String,
        /// Banked usage for the run, including this event.
        #[serde(default)]
        usage_total: Usage,
    },
    /// A child run reached a terminal status.
    ChildDone {
        /// Event time in milliseconds since the Unix epoch; the reducer's clock.
        ts_ms: u64,
        /// 32 hex chars of journaled randomness; the reducer's only entropy.
        random: String,
        /// The parent's `spawn` step.
        step_id: String,
        /// The child run.
        child_run_id: String,
        /// `succeeded`, `failed` or `cancelled`.
        status: Status,
        /// Child output, when the event carried a payload.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output: Option<Value>,
        /// Banked usage for the run, including this event.
        #[serde(default)]
        usage_total: Usage,
    },
}

/// Output of `prepare_event`: what the host does next.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum Prepared {
    /// Call the reducer. For `started`, `init_input` is set: call `init(input)` first,
    /// then `on.started`.
    Reduce {
        /// The event to hand to the reducer.
        reducer_event: ReducerEvent,
        /// Workflow input for `init`; set only for `started`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        init_input: Option<Value>,
        /// The kernel state to pass back into `reduce_step` (fresh for `started`).
        kernel_state: KernelState,
    },
    /// Pure bookkeeping (task `running`, `retrying`, `cancelled`, …). No reducer call;
    /// apply the transition as-is. `state` in it echoes the current checkpoint.
    Lifecycle {
        /// The write-set to apply as-is.
        transition: Transition,
    },
}

/// Input to `reduce_step`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct ReduceStepInput {
    /// The run row as loaded under the run lock.
    pub run: RunRef,
    /// The kernel state `prepare_event` returned.
    pub kernel_state: KernelState,
    /// The trigger event, as passed to `prepare_event`.
    pub event: EventInput,
    /// What the reducer returned.
    pub reduction: Reduction,
}

/// Input to `compute_state_hash`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StateHashInput {
    /// Kernel state to hash.
    pub kernel_state: KernelState,
    /// User state, byte-exact JSON.
    pub state: String,
}

/// Output of `compute_state_hash`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct StateHashOutput {
    /// Lowercase hex sha256 (see `docs/kernel-protocol.md`).
    pub hash: String,
}

/// A `(seq, state_hash)` pair, from the journal or from a re-fold.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct HashAtSeq {
    /// Sequence number.
    pub seq: u64,
    /// State hash after that seq.
    pub hash: String,
}

/// Input to `refold_check`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RefoldCheckInput {
    /// Hashes as journaled, ascending by seq.
    pub expected: Vec<HashAtSeq>,
    /// Hashes the re-fold produced, ascending by seq.
    pub actual: Vec<HashAtSeq>,
}

/// `matches: false` carries the first divergent seq and both hashes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RefoldCheckOutput {
    /// Whether every pair agreed.
    pub matches: bool,
    /// The first divergent seq.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seq: Option<u64>,
    /// Journaled hash at `seq`; empty when the journal has no entry there.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
    /// Re-folded hash at `seq`; empty when the re-fold produced none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
}

/// Input to `derive_ids`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct DeriveIdsInput {
    /// Run identifier.
    pub run_id: String,
    /// Step identifier.
    pub step_id: String,
    /// Attempt for the idempotency key.
    pub attempt: u32,
}

/// Output of `derive_ids`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct DeriveIdsOutput {
    /// `<run_id>:<step_id>`.
    pub task_id: String,
    /// `<run_id>:<step_id>:<attempt>`.
    pub idempotency_key: String,
    /// `run_` followed by the first 26 hex chars of `sha256(task_id)`.
    pub child_run_id: String,
}
