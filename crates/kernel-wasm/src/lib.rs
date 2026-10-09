//! wasm-bindgen surface for the Vlo kernel.
//!
//! Every export is JSON string in, JSON string out, and stateless. All the logic —
//! including error mapping — lives in `vlo_kernel::api`, so the native golden fixtures
//! and this build exercise byte-identical code paths.

#![warn(missing_docs)]

use wasm_bindgen::prelude::wasm_bindgen;

/// Kernel crate version, protocol version and feature list.
#[wasm_bindgen]
pub fn kernel_version() -> String {
    vlo_kernel::api::version_json()
}

/// Field and enum checks on an event envelope; input `EventInput`, value `ValidateEventOutput`.
#[wasm_bindgen]
pub fn validate_event(input: &str) -> String {
    vlo_kernel::api::validate_event_json(input)
}

/// Classify an event into a reducer call or a lifecycle write-set; input `PrepareEventInput`, value `Prepared`.
#[wasm_bindgen]
pub fn prepare_event(input: &str) -> String {
    vlo_kernel::api::prepare_event_json(input)
}

/// Turn a reducer's `(state, commands)` into the write-set; input `ReduceStepInput`, value `Transition`.
#[wasm_bindgen]
pub fn reduce_step(input: &str) -> String {
    vlo_kernel::api::reduce_step_json(input)
}

/// Hash `(kernel_state, state)`; input `StateHashInput`, value `StateHashOutput`.
#[wasm_bindgen]
pub fn compute_state_hash(input: &str) -> String {
    vlo_kernel::api::compute_state_hash_json(input)
}

/// Plan the next attempt from policy, cause and journaled `random`; input `PlanRetryInput`, value `RetryPlan`.
#[wasm_bindgen]
pub fn plan_retry(input: &str) -> String {
    vlo_kernel::api::plan_retry_json(input)
}

/// Find the first divergent `(seq, hash)` between journal and re-fold; input `RefoldCheckInput`, value `RefoldCheckOutput`.
#[wasm_bindgen]
pub fn refold_check(input: &str) -> String {
    vlo_kernel::api::refold_check_json(input)
}

/// Derive `task_id`, `idempotency_key` and `child_run_id`; input `DeriveIdsInput`, value `DeriveIdsOutput`.
#[wasm_bindgen]
pub fn derive_ids(input: &str) -> String {
    vlo_kernel::api::derive_ids_json(input)
}
