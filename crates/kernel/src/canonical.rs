//! Canonical JSON: parse, then re-serialize compact with object keys sorted.
//!
//! `serde_json::Map` is a `BTreeMap` here (the `preserve_order` feature is off), so a
//! parsed value re-serializes with sorted keys and no whitespace. `NaN` / `Infinity`
//! are rejected by the parser and cannot exist inside a `Value`, so a canonical form is
//! always valid JSON.
//!
//! Numbers round-trip exactly within `i64` / `u64`; larger integers become `f64` and
//! canonicalize to their shortest round-trip form. Canonicalization is idempotent:
//! `canonicalize(canonicalize(x)) == canonicalize(x)`.

use serde::Serialize;
use serde_json::Value;

use crate::error::{code, err, KResult};

/// Parse JSON text into a `Value`; `malformed_json` when it is not valid JSON.
pub fn parse(raw: &str) -> KResult<Value> {
    serde_json::from_str(raw).map_err(|e| err(code::MALFORMED_JSON, format!("invalid JSON: {e}")))
}

/// Serialize a `Value` compact with object keys sorted.
pub fn to_string(value: &Value) -> KResult<String> {
    serde_json::to_string(value)
        .map_err(|e| err(code::MALFORMED_JSON, format!("value is not JSON: {e}")))
}

/// Parse `raw` and return its canonical form.
pub fn canonicalize(raw: &str) -> KResult<String> {
    to_string(&parse(raw)?)
}

/// Canonical form of any serializable value. Goes through `Value` on purpose: struct
/// serialization emits fields in declaration order, `Value` emits them sorted.
pub fn canonical_of<T: Serialize>(value: &T) -> KResult<String> {
    let value = serde_json::to_value(value)
        .map_err(|e| err(code::MALFORMED_JSON, format!("value is not JSON: {e}")))?;
    to_string(&value)
}
