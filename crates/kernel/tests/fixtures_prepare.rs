//! Golden fixtures for `prepare_event`.
//!
//! Regenerate with `UPDATE_FIXTURES=1 cargo test -p vlo-kernel`.

mod common;

use common::golden::*;
use serde_json::json;

#[test]
fn prepare_event_reduce_fixtures() {
    let mut started = event("start", "marker", "succeeded");
    started["payload"] = json!(r#"{"n":3}"#);
    check(
        "prepare_event__started",
        "prepare_event",
        json!({ "run": run("created", 0), "event": started }),
    );

    // Carries usage, so the golden pins both the step's own spend and the banked run total.
    let mut result = event("task#1", "task", "succeeded");
    result["attempt"] = json!(1);
    result["payload"] = json!(r#"{"ok":true}"#);
    result["usage"] = json!({ "cpu_ms": 12, "tokens": 300, "cost_micro_usd": 45 });
    let mut banked = kernel_state(json!({ "task#1": task_step("running", 1) }), 1);
    banked["usage_total"] = json!({ "cpu_ms": 5, "tokens": 700, "cost_micro_usd": 10 });
    check(
        "prepare_event__task_succeeded",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": banked,
            "state": r#"{"phase":"work"}"#,
            "event": result,
        }),
    );

    let mut failed = event("task#1", "task", "failed");
    failed["attempt"] = json!(1);
    failed["cause"] = json!("timeout");
    failed["error"] = json!("worker timed out");
    check(
        "prepare_event__task_failed",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": kernel_state(json!({ "task#1": task_step("running", 1) }), 1),
            "state": r#"{"phase":"work"}"#,
            "event": failed,
        }),
    );

    let mut signal = event("signal#1", "signal", "succeeded");
    signal["payload"] = json!(r#"{"approved":true}"#);
    check(
        "prepare_event__signal_delivered",
        "prepare_event",
        json!({
            "run": run("awaiting_signal", 4),
            "kernel_state": kernel_state(
                json!({ "signal#1": { "kind": "signal", "status": "awaiting_signal", "attempt": 0, "signal": "approve" } }),
                1,
            ),
            "state": r#"{"phase":"park"}"#,
            "event": signal,
        }),
    );

    // `ask` awaits `approve`, raced by the kernel-derived deadline `ask:timeout`: whichever
    // settles first prunes the other, and only the winner reaches the reducer.
    let racing = kernel_state(
        json!({
            "ask": { "kind": "signal", "status": "awaiting_signal", "attempt": 0, "signal": "approve" },
            "ask:timeout": { "kind": "timer", "status": "scheduled", "attempt": 0, "fire_at_ms": TS + 60_000 },
        }),
        2,
    );
    let mut approved = event("ask", "signal", "succeeded");
    approved["payload"] = json!(r#"{"approved":true}"#);
    check(
        "prepare_event__signal_cancels_timeout",
        "prepare_event",
        json!({
            "run": run("awaiting_signal", 3),
            "kernel_state": racing,
            "state": r#"{"phase":"park"}"#,
            "event": approved,
        }),
    );
    check(
        "prepare_event__timeout_cancels_signal",
        "prepare_event",
        json!({
            "run": run("awaiting_signal", 3),
            "kernel_state": racing,
            "state": r#"{"phase":"park"}"#,
            "event": event("ask:timeout", "timer", "succeeded"),
        }),
    );

    check(
        "prepare_event__timer_fired",
        "prepare_event",
        json!({
            "run": run("running", 3),
            "kernel_state": kernel_state(
                json!({ "timer#1": { "kind": "timer", "status": "scheduled", "attempt": 0, "fire_at_ms": TS } }),
                1,
            ),
            "state": "null",
            "event": event("timer#1", "timer", "succeeded"),
        }),
    );

    let mut child = event("child#1", "child", "succeeded");
    child["payload"] = json!(r#"{"sum":9}"#);
    check(
        "prepare_event__child_done",
        "prepare_event",
        json!({
            "run": run("running", 3),
            "kernel_state": kernel_state(
                json!({ "child#1": { "kind": "child", "status": "scheduled", "attempt": 0, "child_run_id": "run_child" } }),
                1,
            ),
            "state": "null",
            "event": child,
        }),
    );
}

#[test]
fn prepare_event_lifecycle_fixtures() {
    let mut running = event("task#1", "task", "running");
    running["attempt"] = json!(1);
    check(
        "prepare_event__task_running",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": kernel_state(json!({ "task#1": task_step("scheduled", 1) }), 1),
            "state": r#"{"phase":"work"}"#,
            "event": running,
        }),
    );

    let mut retrying = event("task#1", "task", "retrying");
    retrying["attempt"] = json!(2);
    retrying["cause"] = json!("timeout");
    retrying["payload"] = json!(r#"{"delay_ms":1500}"#);
    // A lost attempt still spent what it spent; the golden pins that it is banked.
    retrying["usage"] = json!({ "cpu_ms": 3, "tokens": 50, "cost_micro_usd": 9 });
    check(
        "prepare_event__task_retrying",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": kernel_state(json!({ "task#1": task_step("running", 1) }), 1),
            "state": r#"{"phase":"work"}"#,
            "event": retrying,
        }),
    );

    let mut cancel = event("cancel", "marker", "cancelled");
    cancel["cause"] = json!("user_cancel");
    check(
        "prepare_event__user_cancel",
        "prepare_event",
        json!({
            "run": run("running", 5),
            "kernel_state": kernel_state(
                json!({ "task#1": task_step("running", 1), "task#2": task_step("scheduled", 1) }),
                2,
            ),
            "state": r#"{"phase":"work"}"#,
            "event": cancel,
        }),
    );

    let mut fail = event("fail", "marker", "failed");
    fail["cause"] = json!("app_error");
    fail["error"] = json!("reducer threw: Cannot read properties of undefined");
    check(
        "prepare_event__run_failed",
        "prepare_event",
        json!({
            "run": run("running", 5),
            "kernel_state": kernel_state(
                json!({ "task#1": task_step("running", 1), "task#2": task_step("scheduled", 1) }),
                2,
            ),
            "state": r#"{"phase":"work"}"#,
            "event": fail,
        }),
    );

    let mut nondeterminism = event("nondeterminism", "marker", "failed");
    nondeterminism["cause"] = json!("nondeterminism_detected");
    check(
        "prepare_event__nondeterminism",
        "prepare_event",
        json!({
            "run": run("running", 5),
            "kernel_state": kernel_state(json!({ "task#1": task_step("running", 1) }), 1),
            "state": r#"{"phase":"work"}"#,
            "event": nondeterminism,
        }),
    );
}

#[test]
fn prepare_event_error_fixtures() {
    let mut result = event("task#9", "task", "succeeded");
    result["attempt"] = json!(1);
    check(
        "prepare_event__unknown_step",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": kernel_state(json!({}), 1),
            "state": "null",
            "event": result,
        }),
    );

    let mut stale = event("task#1", "task", "succeeded");
    stale["attempt"] = json!(1);
    check(
        "prepare_event__already_terminal",
        "prepare_event",
        json!({
            "run": run("running", 2),
            "kernel_state": kernel_state(json!({ "task#1": task_step("running", 2) }), 1),
            "state": "null",
            "event": stale,
        }),
    );

    check(
        "prepare_event__run_closed",
        "prepare_event",
        json!({
            "run": run("completed", 9),
            "kernel_state": kernel_state(json!({}), 1),
            "state": "null",
            "event": event("task#1", "task", "succeeded"),
        }),
    );

    check(
        "prepare_event__invalid_marker",
        "prepare_event",
        json!({
            "run": run("running", 1),
            "kernel_state": kernel_state(json!({}), 0),
            "state": "null",
            "event": event("mystery", "marker", "succeeded"),
        }),
    );

    check(
        "prepare_event__malformed_json",
        "prepare_event",
        json!("not an object"),
    );
}
