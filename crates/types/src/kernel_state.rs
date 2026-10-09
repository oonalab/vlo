//! Kernel-owned per-run bookkeeping, hashed together with the user state.

use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{Kind, RetryPolicy, Status, Usage};

/// Run-level status (the `runs.status` column).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    /// Row exists, `started` not yet folded (child runs and continue-as-new go through the outbox).
    Created,
    /// `started` folded; steps may be open.
    Running,
    /// Every open step is a signal wait: nothing progresses until a signal arrives.
    AwaitingSignal,
    /// Terminal: the reducer issued `complete`.
    Completed,
    /// Terminal: the reducer threw, nondeterminism was detected, or the host failed the run.
    Failed,
    /// Terminal: the user cancelled the run.
    Cancelled,
    /// Terminal: the reducer issued `continue_as_new`; a successor run carries on.
    Continued,
}

impl RunStatus {
    /// `true` for `completed`, `failed`, `cancelled` and `continued`.
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            RunStatus::Completed | RunStatus::Failed | RunStatus::Cancelled | RunStatus::Continued
        )
    }
}

/// Kernel bookkeeping for one open step.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct StepState {
    /// Step kind.
    pub kind: Kind,
    /// Current step status.
    pub status: Status,
    /// Current attempt (1-based for tasks, `0` for every other kind).
    pub attempt: u32,
    /// Activity name (tasks only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activity: Option<String>,
    /// Queue name (tasks only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub queue: Option<String>,
    /// Retry policy (tasks only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub retry: Option<RetryPolicy>,
    /// Child run id (children only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub child_run_id: Option<String>,
    /// Signal name (signal waits only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signal: Option<String>,
    /// Fire time in milliseconds since the Unix epoch (timers only).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fire_at_ms: Option<u64>,
}

/// Kernel-owned state persisted beside the user's state and included in the state hash.
/// Terminal steps are pruned deterministically (`closed_steps` keeps the count) so the
/// structure stays bounded on long runs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct KernelState {
    /// Format version of this structure; currently `1`.
    pub v: u32,
    /// Run-level status as the kernel derives it from the open steps.
    pub status: RunStatus,
    /// Monotonic counter used to derive default step ids.
    pub step_no: u64,
    /// Open steps keyed by step id. Terminal steps are removed, not kept.
    pub steps: BTreeMap<String, StepState>,
    /// Number of steps pruned from `steps` so far.
    #[serde(default)]
    pub closed_steps: u64,
    /// Usage banked across every event of the run, retried attempts included.
    #[serde(default)]
    pub usage_total: Usage,
}

impl KernelState {
    /// A fresh state: `v: 1`, status `created`, no steps, zero usage.
    pub fn new() -> Self {
        KernelState {
            v: 1,
            status: RunStatus::Created,
            step_no: 0,
            steps: BTreeMap::new(),
            closed_steps: 0,
            usage_total: Usage::default(),
        }
    }
}

impl Default for KernelState {
    fn default() -> Self {
        Self::new()
    }
}
