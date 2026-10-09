//! Golden fixtures for `reduce_step`.
//!
//! Regenerate with `UPDATE_FIXTURES=1 cargo test -p vlo-kernel`.

mod common;

use common::golden::*;
use serde_json::json;

#[test]
fn reduce_step_fixtures() {
    let mut started = event("start", "marker", "succeeded");
    started["payload"] = json!(r#"{"n":2}"#);
    let fresh = json!({
        "v": 1, "status": "running", "step_no": 0, "steps": {},
        "closed_steps": 0, "usage_total": { "cpu_ms": 0, "tokens": 0, "cost_micro_usd": 0 },
    });

    check(
        "reduce_step__fan_out",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": r#"{"done":0,"n":2}"#,
                "commands": [task_command(Some("fan/0")), task_command(Some("fan/1"))],
            },
        }),
    );

    check(
        "reduce_step__timer_spawn_signal_emit",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": r#"{"phase":"park"}"#,
                "commands": [
                    { "type": "timer", "fire_in_ms": 60000 },
                    { "type": "spawn", "workflow": "child-flow", "input": { "k": 1 } },
                    { "type": "await_signal", "name": "approve", "timeout_ms": 3600000 },
                    { "type": "emit", "channel": "progress", "data": { "pct": 10 } },
                ],
            },
        }),
    );

    check(
        "reduce_step__await_signal_only",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": r#"{"phase":"park"}"#,
                "commands": [{ "type": "await_signal", "name": "approve" }],
            },
        }),
    );

    // A deadline opens a second step, `ask:timeout`, and a `NewTimer`; the run still parks.
    check(
        "reduce_step__await_signal_timeout",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": r#"{"phase":"park"}"#,
                "commands": [{ "type": "await_signal", "name": "approve", "id": "ask", "timeout_ms": 60000 }],
            },
        }),
    );

    let mut result = event("task#1", "task", "succeeded");
    result["attempt"] = json!(1);
    result["payload"] = json!(r#"{"ok":true}"#);
    result["usage"] = json!({ "cpu_ms": 12, "tokens": 300, "cost_micro_usd": 45 });
    check(
        "reduce_step__complete",
        "reduce_step",
        json!({
            "run": run("running", 4),
            "kernel_state": kernel_state(
                json!({ "task#1": task_step("running", 1), "task#2": task_step("scheduled", 1) }),
                2,
            ),
            "event": result,
            "reduction": {
                "state": r#"{"phase":"done"}"#,
                "commands": [{ "type": "complete", "output": { "total": 2 } }],
            },
        }),
    );

    let mut timed = task_command(Some("slow"));
    timed["timeout_ms"] = json!(30000);
    check(
        "reduce_step__task_timeout",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": { "state": r#"{"phase":"work"}"#, "commands": [timed] },
        }),
    );

    check(
        "reduce_step__continue_as_new",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": r#"{"phase":"rollover"}"#,
                "commands": [{ "type": "continue_as_new", "input": { "cursor": 10 } }],
            },
        }),
    );

    check(
        "reduce_step__duplicate_step_id",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": "{}",
                "commands": [task_command(Some("same")), task_command(Some("same"))],
            },
        }),
    );

    check(
        "reduce_step__commands_after_completion",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": "{}",
                "commands": [{ "type": "complete", "output": 1 }, task_command(None)],
            },
        }),
    );

    check(
        "reduce_step__multiple_completions",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": {
                "state": "{}",
                "commands": [{ "type": "complete", "output": 1 }, { "type": "complete", "output": 2 }],
            },
        }),
    );

    check(
        "reduce_step__invalid_command",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": { "state": "{}", "commands": [{ "type": "timer" }] },
        }),
    );

    check(
        "reduce_step__malformed_state",
        "reduce_step",
        json!({
            "run": run("created", 0),
            "kernel_state": fresh,
            "event": started,
            "reduction": { "state": "{oops", "commands": [] },
        }),
    );
}
