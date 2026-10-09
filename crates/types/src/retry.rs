//! Retry policy and the plan the kernel derives from it.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// How the delay grows between attempts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Backoff {
    /// Every retry waits `initial_ms`.
    Fixed,
    /// The delay is `initial_ms * factor^(attempt - 1)`, capped at `max_ms`.
    Exponential,
}

/// Randomization applied to the computed delay.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Jitter {
    /// Use the computed delay as-is.
    None,
    /// Full jitter: scale the delay by a uniform fraction taken from `random`, so the
    /// result lies in `[0, delay]`.
    Full,
}

/// Declared per activity in the schema registry (see `docs/workflows.md`). Integers only
/// so the policy can live inside the hashed `KernelState`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct RetryPolicy {
    /// Total attempts including the first. `1` means never retry.
    pub max_attempts: u32,
    /// Backoff shape.
    pub backoff: Backoff,
    /// Base delay in milliseconds. Default `1_000`.
    #[serde(default = "default_initial_ms")]
    pub initial_ms: u64,
    /// Delay cap in milliseconds. Default `600_000`.
    #[serde(default = "default_max_ms")]
    pub max_ms: u64,
    /// Multiplier for exponential backoff, e.g. `2`.
    #[serde(default = "default_factor")]
    pub factor: u32,
    /// Jitter mode. Default `full`.
    #[serde(default = "default_jitter")]
    pub jitter: Jitter,
}

fn default_initial_ms() -> u64 {
    1_000
}
fn default_max_ms() -> u64 {
    600_000
}
fn default_factor() -> u32 {
    2
}
fn default_jitter() -> Jitter {
    Jitter::Full
}

impl Default for RetryPolicy {
    fn default() -> Self {
        RetryPolicy {
            max_attempts: 3,
            backoff: Backoff::Exponential,
            initial_ms: default_initial_ms(),
            max_ms: default_max_ms(),
            factor: default_factor(),
            jitter: default_jitter(),
        }
    }
}

/// Input to `plan_retry`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct PlanRetryInput {
    /// Policy of the step that failed.
    pub policy: RetryPolicy,
    /// The attempt that just failed (1-based).
    pub attempt: u32,
    /// Why it failed. Non-retryable causes always yield `retry: false`.
    pub cause: crate::Cause,
    /// Journaled randomness (32 hex chars); the only entropy source for jitter.
    pub random: String,
}

/// `retry: false` means the step fails for good; `next_attempt` / `delay_ms` are set iff `retry`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct RetryPlan {
    /// Whether another attempt is scheduled.
    pub retry: bool,
    /// The attempt to schedule (`attempt + 1`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_attempt: Option<u32>,
    /// Delay before that attempt, in milliseconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delay_ms: Option<u64>,
}

impl RetryPlan {
    /// The plan that gives up.
    pub fn stop() -> Self {
        RetryPlan {
            retry: false,
            next_attempt: None,
            delay_ms: None,
        }
    }
    /// The plan that schedules `next_attempt` after `delay_ms`.
    pub fn again(next_attempt: u32, delay_ms: u64) -> Self {
        RetryPlan {
            retry: true,
            next_attempt: Some(next_attempt),
            delay_ms: Some(delay_ms),
        }
    }
}
