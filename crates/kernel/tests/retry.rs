//! Retry planning: caps, non-retryable causes, and jitter determinism.

use vlo_kernel::code;
use vlo_kernel::plan_retry;
use vlo_types::{Backoff, Cause, Jitter, PlanRetryInput, RetryPolicy};

fn policy(backoff: Backoff, jitter: Jitter) -> RetryPolicy {
    RetryPolicy {
        max_attempts: 5,
        backoff,
        initial_ms: 1_000,
        max_ms: 10_000,
        factor: 2,
        jitter,
    }
}

fn plan(policy: RetryPolicy, attempt: u32, cause: Cause, random: &str) -> vlo_types::RetryPlan {
    plan_retry(&PlanRetryInput {
        policy,
        attempt,
        cause,
        random: random.to_string(),
    })
    .expect("plan_retry")
}

const ZERO: &str = "00000000000000000000000000000000";
const MAX: &str = "ffffffffffffffffffffffffffffffff";

#[test]
fn exponential_backoff_doubles_then_caps_at_max_ms() {
    let expected = [1_000, 2_000, 4_000, 8_000];
    for (index, want) in expected.iter().enumerate() {
        let attempt = index as u32 + 1;
        let plan = plan(
            policy(Backoff::Exponential, Jitter::None),
            attempt,
            Cause::Timeout,
            ZERO,
        );
        assert_eq!(plan.delay_ms, Some(*want), "attempt {attempt}");
        assert_eq!(plan.next_attempt, Some(attempt + 1));
    }
}

#[test]
fn exponential_backoff_saturates_rather_than_overflowing() {
    let wide = RetryPolicy {
        max_attempts: u32::MAX,
        initial_ms: u64::MAX / 2,
        max_ms: u64::MAX,
        factor: u32::MAX,
        ..policy(Backoff::Exponential, Jitter::None)
    };
    let plan = plan(wide, 1_000_000, Cause::Timeout, ZERO);
    assert_eq!(plan.delay_ms, Some(u64::MAX));
}

#[test]
fn fixed_backoff_ignores_the_attempt_number() {
    for attempt in 1..=4 {
        let plan = plan(
            policy(Backoff::Fixed, Jitter::None),
            attempt,
            Cause::AppError,
            MAX,
        );
        assert_eq!(plan.delay_ms, Some(1_000));
    }
}

#[test]
fn full_jitter_spans_zero_to_the_base_delay() {
    let zero = plan(
        policy(Backoff::Fixed, Jitter::Full),
        1,
        Cause::Timeout,
        ZERO,
    );
    assert_eq!(zero.delay_ms, Some(0));

    let full = plan(policy(Backoff::Fixed, Jitter::Full), 1, Cause::Timeout, MAX);
    assert_eq!(full.delay_ms, Some(1_000));

    let half = plan(
        policy(Backoff::Fixed, Jitter::Full),
        1,
        Cause::Timeout,
        "8000000000000000ffffffffffffffff",
    );
    assert_eq!(half.delay_ms, Some(500));
}

#[test]
fn jitter_is_a_pure_function_of_the_journaled_random() {
    let random = "1a2b3c4d5e6f70819a2b3c4d5e6f7081";
    let first = plan(
        policy(Backoff::Exponential, Jitter::Full),
        3,
        Cause::Timeout,
        random,
    );
    let second = plan(
        policy(Backoff::Exponential, Jitter::Full),
        3,
        Cause::Timeout,
        random,
    );
    assert_eq!(first, second);
}

#[test]
fn stops_at_max_attempts() {
    let policy = policy(Backoff::Exponential, Jitter::None);
    assert!(plan(policy.clone(), 4, Cause::Timeout, ZERO).retry);
    assert!(!plan(policy.clone(), 5, Cause::Timeout, ZERO).retry);
    assert!(!plan(policy, 99, Cause::Timeout, ZERO).retry);
}

#[test]
fn max_attempts_one_never_retries() {
    let once = RetryPolicy {
        max_attempts: 1,
        ..policy(Backoff::Exponential, Jitter::None)
    };
    assert_eq!(
        plan(once, 1, Cause::Timeout, ZERO),
        vlo_types::RetryPlan::stop()
    );
}

#[test]
fn non_retryable_causes_stop_immediately() {
    for cause in [
        Cause::SchemaViolation,
        Cause::UserCancel,
        Cause::NondeterminismDetected,
    ] {
        let plan = plan(policy(Backoff::Exponential, Jitter::None), 1, cause, ZERO);
        assert!(!plan.retry, "{cause:?} must not retry");
        assert_eq!(plan.next_attempt, None);
        assert_eq!(plan.delay_ms, None);
    }
}

#[test]
fn retryable_causes_retry() {
    for cause in [Cause::Timeout, Cause::HeartbeatLost, Cause::AppError] {
        assert!(plan(policy(Backoff::Exponential, Jitter::None), 1, cause, ZERO).retry);
    }
}

#[test]
fn rejects_random_that_is_not_thirty_two_lowercase_hex() {
    for random in ["", "abc", &"A".repeat(32), &"g".repeat(32), &"a".repeat(33)] {
        let error = plan_retry(&PlanRetryInput {
            policy: policy(Backoff::Fixed, Jitter::Full),
            attempt: 1,
            cause: Cause::Timeout,
            random: random.to_string(),
        })
        .expect_err("expected rejection");
        assert_eq!(error.code, code::INVALID_EVENT);
    }
}
