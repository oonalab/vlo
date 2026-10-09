//! Envelope validation. Runs before every other export so no later stage has to
//! re-check field shape.

use serde_json::Value;
use vlo_types::{EventInput, INLINE_LIMIT_BYTES};

use crate::canonical;
use crate::error::{code, err, err_step, KResult};

/// `random` is 32 lowercase hex chars of journaled entropy.
pub const RANDOM_HEX_LEN: usize = 32;

/// Prefix of an offloaded payload reference.
pub const BLOB_REF_PREFIX: &str = "blob://sha256/";

/// Whether `value` is exactly [`RANDOM_HEX_LEN`] lowercase hex chars.
pub fn is_random_hex(value: &str) -> bool {
    value.len() == RANDOM_HEX_LEN
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Field/enum checks plus the inline payload limit. Returns the normalized event; the
/// kernel keeps payloads byte-exact, so normalization is currently a no-op clone that
/// exists so the host has one place to adopt future coercions.
pub fn validate_event(event: &EventInput) -> KResult<EventInput> {
    if event.run_id.is_empty() {
        return Err(err(code::INVALID_EVENT, "run_id is empty"));
    }
    if event.step_id.is_empty() {
        return Err(err(code::INVALID_EVENT, "step_id is empty"));
    }
    if !is_random_hex(&event.random) {
        return Err(err_step(
            code::INVALID_EVENT,
            "random must be 32 lowercase hex chars",
            &event.step_id,
        ));
    }
    if event.payload.is_some() && event.payload_ref.is_some() {
        return Err(err_step(
            code::INVALID_EVENT,
            "at most one of payload / payload_ref",
            &event.step_id,
        ));
    }
    if let Some(reference) = &event.payload_ref {
        if !reference.starts_with(BLOB_REF_PREFIX) {
            return Err(err_step(
                code::INVALID_EVENT,
                format!("payload_ref must start with {BLOB_REF_PREFIX}"),
                &event.step_id,
            ));
        }
    }
    if let Some(payload) = &event.payload {
        if payload.len() > INLINE_LIMIT_BYTES {
            return Err(err_step(
                code::PAYLOAD_TOO_LARGE,
                format!(
                    "inline payload is {} bytes, limit is {INLINE_LIMIT_BYTES}",
                    payload.len()
                ),
                &event.step_id,
            ));
        }
        canonical::parse(payload)?;
    }
    Ok(event.clone())
}

/// The payload as a value. `payload_ref` must be resolved by the host before the kernel
/// sees it, because a reducer event carries the value, not the pointer.
pub fn payload_value(event: &EventInput) -> KResult<Value> {
    if event.payload_ref.is_some() {
        return Err(err_step(
            code::INVALID_EVENT,
            "payload_ref must be resolved to an inline payload before folding",
            &event.step_id,
        ));
    }
    match &event.payload {
        Some(payload) => canonical::parse(payload),
        None => Ok(Value::Null),
    }
}

/// Like [`payload_value`] but distinguishes "absent" from "present and null".
pub fn optional_payload_value(event: &EventInput) -> KResult<Option<Value>> {
    if event.payload.is_none() && event.payload_ref.is_none() {
        return Ok(None);
    }
    payload_value(event).map(Some)
}
