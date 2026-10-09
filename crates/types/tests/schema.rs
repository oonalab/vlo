//! Generates `schema/kernel-protocol.schema.json` and fails when the committed file drifts.
//! Regenerate with `UPDATE_SCHEMA=1 cargo test -p vlo-types`.

use std::path::PathBuf;

use schemars::{schema_for, JsonSchema};
use serde::{Deserialize, Serialize};
use vlo_types::*;

/// One root type that references every wire type, so a single schema file carries them
/// all under `$defs`.
#[derive(Serialize, Deserialize, JsonSchema)]
#[allow(dead_code)]
struct KernelProtocol {
    version: KernelVersion,
    event_input: EventInput,
    envelope: Envelope,
    command: Command,
    reduction: Reduction,
    kernel_state: KernelState,
    run_ref: RunRef,
    transition: Transition,
    prepare_event_input: PrepareEventInput,
    prepared: Prepared,
    reducer_event: ReducerEvent,
    reduce_step_input: ReduceStepInput,
    state_hash_input: StateHashInput,
    state_hash_output: StateHashOutput,
    plan_retry_input: PlanRetryInput,
    retry_plan: RetryPlan,
    refold_check_input: RefoldCheckInput,
    refold_check_output: RefoldCheckOutput,
    derive_ids_input: DeriveIdsInput,
    derive_ids_output: DeriveIdsOutput,
    kernel_error: KernelError,
    validate_event_output: ValidateEventOutput,
}

fn schema_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../schema/kernel-protocol.schema.json")
}

#[test]
fn kernel_protocol_schema_is_current() {
    let schema = schema_for!(KernelProtocol);
    let rendered = serde_json::to_string_pretty(&schema).unwrap() + "\n";
    let path = schema_path();

    if std::env::var("UPDATE_SCHEMA").is_ok() {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, &rendered).unwrap();
        return;
    }

    let committed = std::fs::read_to_string(&path).unwrap_or_else(|_| {
        panic!(
            "{} missing; run `UPDATE_SCHEMA=1 cargo test -p vlo-types`",
            path.display()
        )
    });
    assert_eq!(
        committed, rendered,
        "kernel-protocol.schema.json drifted; run `UPDATE_SCHEMA=1 cargo test -p vlo-types`"
    );
}
