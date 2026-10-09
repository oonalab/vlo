#![allow(dead_code)]

//! Golden-fixture harness shared by the `fixtures_*` test files.
//!
//! Each case is `{export, input, output}` in `fixtures/kernel/`. The Node test suite
//! replays the same files through the compiled wasm, so a fixture that passes here and
//! fails there means the wasm build drifted from the native one.
//!
//! Regenerate with `UPDATE_FIXTURES=1 cargo test -p vlo-kernel --test fixtures`.

use std::path::PathBuf;

use serde_json::{json, Value};
use vlo_kernel::api;

pub fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/kernel")
}

fn invoke(export: &str, input: &Value) -> Value {
    let raw = input.to_string();
    let output = match export {
        "kernel_version" => api::version_json(),
        "validate_event" => api::validate_event_json(&raw),
        "prepare_event" => api::prepare_event_json(&raw),
        "reduce_step" => api::reduce_step_json(&raw),
        "compute_state_hash" => api::compute_state_hash_json(&raw),
        "plan_retry" => api::plan_retry_json(&raw),
        "refold_check" => api::refold_check_json(&raw),
        "derive_ids" => api::derive_ids_json(&raw),
        other => panic!("unknown export {other}"),
    };
    serde_json::from_str(&output).expect("export returned invalid JSON")
}

pub fn check(name: &str, export: &str, input: Value) {
    let output = invoke(export, &input);
    let document = json!({ "export": export, "input": input, "output": output });
    let rendered = serde_json::to_string_pretty(&document).expect("render") + "\n";
    let path = fixtures_dir().join(format!("{name}.json"));

    if std::env::var("UPDATE_FIXTURES").is_ok() {
        std::fs::create_dir_all(path.parent().expect("parent")).expect("mkdir");
        std::fs::write(&path, &rendered).expect("write fixture");
        return;
    }

    let committed = std::fs::read_to_string(&path).unwrap_or_else(|_| {
        panic!(
            "{} missing; run `UPDATE_FIXTURES=1 cargo test -p vlo-kernel --test fixtures`",
            path.display()
        )
    });
    assert_eq!(
        committed, rendered,
        "fixture {name} drifted; run `UPDATE_FIXTURES=1 cargo test -p vlo-kernel --test fixtures`"
    );
}

pub const RANDOM: &str = "9f86d081884c7d659a2feaa0c55ad015";
pub const TS: u64 = 1_700_000_000_000;

pub fn event(step_id: &str, kind: &str, status: &str) -> Value {
    json!({
        "run_id": "run_fixture",
        "step_id": step_id,
        "attempt": 0,
        "kind": kind,
        "status": status,
        "ts_ms": TS,
        "random": RANDOM,
    })
}

pub fn run(status: &str, last_seq: u64) -> Value {
    json!({
        "run_id": "run_fixture",
        "workflow": "example",
        "bundle_digest": "sha256:bundle",
        "status": status,
        "last_seq": last_seq,
    })
}

pub fn task_step(status: &str, attempt: u32) -> Value {
    json!({
        "kind": "task",
        "status": status,
        "attempt": attempt,
        "activity": "plan",
        "queue": "default",
        "retry": retry_policy(),
    })
}

pub fn retry_policy() -> Value {
    json!({
        "max_attempts": 3,
        "backoff": "exponential",
        "initial_ms": 1000,
        "max_ms": 600000,
        "factor": 2,
        "jitter": "full",
    })
}

pub fn kernel_state(steps: Value, step_no: u64) -> Value {
    json!({
        "v": 1,
        "status": "running",
        "step_no": step_no,
        "steps": steps,
        "closed_steps": 0,
        "usage_total": { "cpu_ms": 0, "tokens": 0, "cost_micro_usd": 0 },
    })
}

pub fn task_command(id: Option<&str>) -> Value {
    let mut command = json!({ "type": "task", "activity": "plan", "input": { "a": 1 } });
    if let Some(id) = id {
        command["id"] = json!(id);
    }
    command
}
