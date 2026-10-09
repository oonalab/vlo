//! String-in / string-out surface: exactly what crosses the wasm boundary.
//!
//! `kernel-wasm` is a one-line shim over this module and the golden fixtures exercise
//! it directly, so the native tests and the wasm build can never drift apart.

use serde::Serialize;
use serde_json::Value;
use vlo_types::{
    DeriveIdsInput, KernelError, KernelResult, KernelVersion, PlanRetryInput, PrepareEventInput,
    ReduceStepInput, RefoldCheckInput, StateHashInput, StateHashOutput, ValidateEventOutput,
    PROTOCOL_VERSION,
};

use crate::error::{code, KResult};
use crate::{hash, ids, prepare, reduce, refold, retry, validate};

/// Capabilities the host may branch on. Additive only.
pub const FEATURES: &[&str] = &["canonical_json_v1", "state_hash_v1", "refold_v1"];

/// The [`KernelVersion`] of this build: crate version, [`PROTOCOL_VERSION`], [`FEATURES`].
pub fn version() -> KernelVersion {
    KernelVersion {
        version: env!("CARGO_PKG_VERSION").to_string(),
        protocol: PROTOCOL_VERSION,
        features: FEATURES.iter().map(|f| f.to_string()).collect(),
    }
}

/// `kernel_version` export. Value: [`KernelVersion`].
pub fn version_json() -> String {
    render(Ok(version()))
}

/// `validate_event` export. Input: [`EventInput`](vlo_types::EventInput); value: [`ValidateEventOutput`].
pub fn validate_event_json(input: &str) -> String {
    render(parse::<vlo_types::EventInput>(input).and_then(|event| {
        validate::validate_event(&event).map(|normalized| ValidateEventOutput { normalized })
    }))
}

/// `prepare_event` export. Input: [`PrepareEventInput`]; value: [`Prepared`](vlo_types::Prepared).
pub fn prepare_event_json(input: &str) -> String {
    render(parse::<PrepareEventInput>(input).and_then(|i| prepare::prepare_event(&i)))
}

/// `reduce_step` export. Input: [`ReduceStepInput`]; value: [`Transition`](vlo_types::Transition).
pub fn reduce_step_json(input: &str) -> String {
    render(parse::<ReduceStepInput>(input).and_then(|i| reduce::reduce_step(&i)))
}

/// `compute_state_hash` export. Input: [`StateHashInput`]; value: [`StateHashOutput`].
pub fn compute_state_hash_json(input: &str) -> String {
    render(parse::<StateHashInput>(input).and_then(|i| {
        hash::state_hash(&i.kernel_state, &i.state).map(|hash| StateHashOutput { hash })
    }))
}

/// `plan_retry` export. Input: [`PlanRetryInput`]; value: [`RetryPlan`](vlo_types::RetryPlan).
pub fn plan_retry_json(input: &str) -> String {
    render(parse::<PlanRetryInput>(input).and_then(|i| retry::plan_retry(&i)))
}

/// `refold_check` export. Input: [`RefoldCheckInput`]; value: [`RefoldCheckOutput`](vlo_types::RefoldCheckOutput).
pub fn refold_check_json(input: &str) -> String {
    render(parse::<RefoldCheckInput>(input).map(|i| refold::refold_check(&i)))
}

/// `derive_ids` export. Input: [`DeriveIdsInput`]; value: [`DeriveIdsOutput`](vlo_types::DeriveIdsOutput).
pub fn derive_ids_json(input: &str) -> String {
    render(parse::<DeriveIdsInput>(input).map(|i| ids::derive_ids(&i)))
}

fn parse<T: serde::de::DeserializeOwned>(input: &str) -> KResult<T> {
    serde_json::from_str(input).map_err(|e| crate::error::err(code::MALFORMED_JSON, e.to_string()))
}

/// Serialization of a `KernelResult` cannot fail for our own types; if it somehow did,
/// fall back to a hand-written error object rather than panicking in wasm.
fn render<T: Serialize>(result: KResult<T>) -> String {
    let result = match result {
        Ok(value) => KernelResult::ok(value),
        Err(error) => KernelResult::err(error),
    };
    serde_json::to_string(&result).unwrap_or_else(|e| {
        let fallback: KernelResult<Value> = KernelResult::err(KernelError {
            code: code::MALFORMED_JSON.to_string(),
            message: format!("kernel output is not serialisable: {e}"),
            seq: None,
            step_id: None,
        });
        serde_json::to_string(&fallback)
            .unwrap_or_else(|_| r#"{"ok":false,"error":{"code":"malformed_json","message":"kernel output is not serialisable"}}"#.to_string())
    })
}
