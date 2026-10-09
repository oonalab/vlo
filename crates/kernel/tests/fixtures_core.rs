//! Golden fixtures for the stateless exports.
//!
//! Regenerate with `UPDATE_FIXTURES=1 cargo test -p vlo-kernel`.

mod common;

use common::golden::*;
use serde_json::json;

#[test]
fn version_fixture() {
    check("kernel_version", "kernel_version", json!(null));
}

#[test]
fn validate_event_fixtures() {
    let mut ok = event("task#1", "task", "succeeded");
    ok["attempt"] = json!(1);
    ok["payload"] = json!(r#"{"ok":true}"#);
    ok["usage"] = json!({ "cpu_ms": 12, "tokens": 300, "cost_micro_usd": 45 });
    check("validate_event__ok", "validate_event", ok);

    let mut bad_random = event("task#1", "task", "succeeded");
    bad_random["random"] = json!("not-hex");
    check("validate_event__bad_random", "validate_event", bad_random);

    let mut both = event("task#1", "task", "succeeded");
    both["payload"] = json!("1");
    both["payload_ref"] = json!("blob://sha256/abc");
    check("validate_event__payload_conflict", "validate_event", both);
}

#[test]
fn state_hash_fixtures() {
    check(
        "compute_state_hash__basic",
        "compute_state_hash",
        json!({
            "kernel_state": kernel_state(json!({ "task#1": task_step("running", 1) }), 1),
            "state": r#"{ "b": 2, "a": 1 }"#,
        }),
    );
    check(
        "compute_state_hash__malformed_state",
        "compute_state_hash",
        json!({ "kernel_state": kernel_state(json!({}), 0), "state": "{oops" }),
    );
}

#[test]
fn plan_retry_fixtures() {
    check(
        "plan_retry__exponential_full_jitter",
        "plan_retry",
        json!({ "policy": retry_policy(), "attempt": 2, "cause": "timeout", "random": RANDOM }),
    );
    check(
        "plan_retry__non_retryable_cause",
        "plan_retry",
        json!({ "policy": retry_policy(), "attempt": 1, "cause": "schema_violation", "random": RANDOM }),
    );
    check(
        "plan_retry__attempts_exhausted",
        "plan_retry",
        json!({ "policy": retry_policy(), "attempt": 3, "cause": "app_error", "random": RANDOM }),
    );
    check(
        "plan_retry__invalid_random",
        "plan_retry",
        json!({ "policy": retry_policy(), "attempt": 1, "cause": "timeout", "random": "short" }),
    );
}

#[test]
fn refold_and_ids_fixtures() {
    check(
        "refold_check__matches",
        "refold_check",
        json!({
            "expected": [{ "seq": 1, "hash": "a" }, { "seq": 2, "hash": "b" }],
            "actual": [{ "seq": 1, "hash": "a" }, { "seq": 2, "hash": "b" }],
        }),
    );
    check(
        "refold_check__diverges",
        "refold_check",
        json!({
            "expected": [{ "seq": 1, "hash": "a" }, { "seq": 2, "hash": "b" }],
            "actual": [{ "seq": 1, "hash": "a" }, { "seq": 2, "hash": "z" }],
        }),
    );
    check(
        "derive_ids__basic",
        "derive_ids",
        json!({ "run_id": "run_fixture", "step_id": "task#1", "attempt": 2 }),
    );
}
