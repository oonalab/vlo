//! Retry planning. Pure: the only entropy is the `random` the host already journaled,
//! so a replay plans the same delay.

use vlo_types::{Backoff, Cause, Jitter, PlanRetryInput, RetryPlan, RetryPolicy};

use crate::error::{code, err, KResult};
use crate::validate::is_random_hex;

/// Exponent cap. With any sane factor the delay saturates at `max_ms` long before this.
const MAX_EXPONENT: u32 = 64;

/// Hex chars of `random` consumed by full jitter.
const JITTER_HEX_LEN: usize = 16;

fn is_retryable(cause: Cause) -> bool {
    !matches!(
        cause,
        Cause::SchemaViolation | Cause::UserCancel | Cause::NondeterminismDetected
    )
}

fn base_delay_ms(policy: &RetryPolicy, attempt: u32) -> u64 {
    let max = policy.max_ms as u128;
    let base = match policy.backoff {
        Backoff::Fixed => policy.initial_ms as u128,
        Backoff::Exponential if policy.factor <= 1 => policy.initial_ms as u128,
        Backoff::Exponential => {
            let mut value = policy.initial_ms as u128;
            for _ in 1..attempt.min(MAX_EXPONENT) {
                value = value.saturating_mul(policy.factor as u128);
                if value >= max {
                    break;
                }
            }
            value
        }
    };
    base.min(max) as u64
}

/// Decide whether the attempt that just failed is retried, and after what delay.
///
/// Stops for a non-retryable cause (`schema_violation`, `user_cancel`,
/// `nondeterminism_detected`) or once `attempt >= max_attempts`; otherwise the delay is
/// the policy's backoff with jitter drawn from `random`. Errors with `invalid_event` when
/// `random` is not 32 lowercase hex chars.
pub fn plan_retry(input: &PlanRetryInput) -> KResult<RetryPlan> {
    if !is_random_hex(&input.random) {
        return Err(err(
            code::INVALID_EVENT,
            "random must be 32 lowercase hex chars",
        ));
    }
    if !is_retryable(input.cause) {
        return Ok(RetryPlan::stop());
    }
    if input.attempt >= input.policy.max_attempts {
        return Ok(RetryPlan::stop());
    }

    let base = base_delay_ms(&input.policy, input.attempt);
    let delay_ms = match input.policy.jitter {
        Jitter::None => base,
        Jitter::Full => {
            let entropy = u64::from_str_radix(&input.random[..JITTER_HEX_LEN], 16)
                .map_err(|e| err(code::INVALID_EVENT, format!("random is not hex: {e}")))?;
            ((base as u128 * entropy as u128) / u64::MAX as u128) as u64
        }
    };
    Ok(RetryPlan::again(input.attempt + 1, delay_ms))
}
