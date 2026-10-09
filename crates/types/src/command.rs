//! Commands a reducer returns, and the reduction that carries them (see `docs/workflows.md`).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::RetryPolicy;

/// What a reducer asks the kernel for. Seven commands, closed set (see `docs/workflows.md`).
///
/// `id` lets a reducer name a step explicitly (needed for fan-out bookkeeping);
/// otherwise the kernel derives `<kind>#<n>` from `KernelState::step_no`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    /// Dispatch an activity to a worker; opens a `task` step in `scheduled`.
    Task {
        /// Activity name the worker dispatches on.
        activity: String,
        /// Input schema reference (`<name>@<content-hash>`).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        schema_ref: Option<String>,
        /// Activity input.
        input: Value,
        /// Queue to push to; `default` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        queue: Option<String>,
        /// Retry policy; the default policy when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        retry: Option<RetryPolicy>,
        /// Lease duration in milliseconds; `60_000` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        lease_ttl_ms: Option<u64>,
        /// Wall-clock budget for one attempt. The worker aborts at it; the host's backstop
        /// reaps the attempt if the worker never answers.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        /// Explicit step id; `task#<n>` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    /// Open a `timer` step that fires at an absolute or relative time.
    Timer {
        /// Delay in milliseconds from the event's `ts_ms`; ignored when `fire_at_ms` is set.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fire_in_ms: Option<u64>,
        /// Absolute fire time in milliseconds since the Unix epoch. One of the two is required.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        fire_at_ms: Option<u64>,
        /// Explicit step id; `timer#<n>` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    /// Start a child run; opens a `child` step in `scheduled`.
    Spawn {
        /// Workflow name of the child.
        workflow: String,
        /// Child run input.
        input: Value,
        /// Explicit step id; `child#<n>` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    /// Park on a named signal; opens a `signal` step in `awaiting_signal`.
    AwaitSignal {
        /// Signal name.
        name: String,
        /// Payload schema reference (`<name>@<content-hash>`).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        schema_ref: Option<String>,
        /// Wait budget in milliseconds; `None` waits forever.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        /// Explicit step id; `signal#<n>` when `None`.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    /// Publish to a side channel. Never journaled, never replayed.
    Emit {
        /// Channel name.
        channel: String,
        /// Payload.
        data: Value,
    },
    /// End the run as `completed`. Must be the last command of the reduction.
    Complete {
        /// Workflow output.
        output: Value,
    },
    /// End the run as `continued` and start a successor with `input`. Must be the last
    /// command of the reduction.
    ContinueAsNew {
        /// Input for the successor run.
        input: Value,
    },
}

/// What the reducer returned: the new user state (byte-exact JSON) and its commands.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Reduction {
    /// New user state, byte-exact JSON.
    pub state: String,
    /// Commands in issue order.
    #[serde(default)]
    pub commands: Vec<Command>,
}
