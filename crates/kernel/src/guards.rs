//! Shared preconditions for `prepare_event`: the checks that decide whether an event
//! may touch a step at all, before anything is folded.

use serde_json::Value;
use vlo_types::{EventInput, KernelState, Kind, PrepareEventInput, Status, StepState};

use crate::canonical;
use crate::error::{code, err, err_step, KResult};
use crate::step_machine::is_legal;

/// The kernel state, or `invalid_event` when absent (only `started` may omit it).
pub fn require_kernel_state(input: &PrepareEventInput) -> KResult<&KernelState> {
    input.kernel_state.as_ref().ok_or_else(|| {
        err(
            code::INVALID_EVENT,
            "kernel_state is required for every event except started",
        )
    })
}

/// The open step the event names, or `unknown_step`; `illegal_transition` when its kind
/// is not `kind`.
pub fn require_step<'a>(
    kernel_state: &'a KernelState,
    event: &EventInput,
    kind: Kind,
) -> KResult<&'a StepState> {
    let step = kernel_state.steps.get(&event.step_id).ok_or_else(|| {
        err_step(
            code::UNKNOWN_STEP,
            "no open step with this id",
            &event.step_id,
        )
    })?;
    if step.kind != kind {
        return Err(err_step(
            code::ILLEGAL_TRANSITION,
            format!("step is a {:?}, event is a {kind:?}", step.kind),
            &event.step_id,
        ));
    }
    Ok(step)
}

/// Reject an event whose `attempt` is not the step's current one: `already_terminal` for
/// a past attempt, `illegal_transition` for a future one.
pub fn check_attempt(step: &StepState, event: &EventInput) -> KResult<()> {
    if event.attempt == step.attempt {
        return Ok(());
    }
    let code = if event.attempt < step.attempt {
        code::ALREADY_TERMINAL
    } else {
        code::ILLEGAL_TRANSITION
    };
    Err(err_step(
        code,
        format!(
            "event is for attempt {}, step is on attempt {}",
            event.attempt, step.attempt
        ),
        &event.step_id,
    ))
}

/// Reject the edge `step.status → event.status` when the state machine has no such edge
/// (`illegal_transition`).
pub fn check_legal(step: &StepState, event: &EventInput) -> KResult<()> {
    if is_legal(step.status, event.status) {
        return Ok(());
    }
    Err(err_step(
        code::ILLEGAL_TRANSITION,
        format!(
            "{:?} → {:?} is not a legal step edge",
            step.status, event.status
        ),
        &event.step_id,
    ))
}

/// Set the status of an open step; a no-op for an unknown id.
pub fn set_status(kernel_state: &mut KernelState, step_id: &str, status: Status) {
    if let Some(step) = kernel_state.steps.get_mut(step_id) {
        step.status = status;
    }
}

/// The `delay_ms` (milliseconds) a `retrying` event carries in its payload object; `0`
/// when there is no payload or no `delay_ms`. Errors with `invalid_event` on any other shape.
pub fn retry_delay_ms(event: &EventInput) -> KResult<u64> {
    let Some(payload) = &event.payload else {
        return Ok(0);
    };
    match canonical::parse(payload)? {
        Value::Object(map) => match map.get("delay_ms") {
            None => Ok(0),
            Some(Value::Number(n)) => n.as_u64().ok_or_else(|| {
                err_step(
                    code::INVALID_EVENT,
                    "delay_ms must be a non-negative integer",
                    &event.step_id,
                )
            }),
            Some(_) => Err(err_step(
                code::INVALID_EVENT,
                "delay_ms must be a number",
                &event.step_id,
            )),
        },
        _ => Err(err_step(
            code::INVALID_EVENT,
            "a retrying event payload must be an object",
            &event.step_id,
        )),
    }
}
