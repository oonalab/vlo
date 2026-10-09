//! Kernel error codes and constructors.
//!
//! The kernel never panics and never returns a bare string: every failure is a
//! [`KernelError`] with one of the codes in [`code`], so the host can branch on it.

use vlo_types::KernelError;

/// The closed set of kernel error codes.
pub mod code {
    /// An export input, an inline payload, a reducer state or a kernel output is not valid JSON.
    pub const MALFORMED_JSON: &str = "malformed_json";
    /// The envelope fails a field check (empty id, bad `random`, both payload forms, bad
    /// `payload_ref` prefix, unroutable kind/status), belongs to another run, omits
    /// `kernel_state`, still carries an unresolved `payload_ref`, has a bad `delay_ms`, or is
    /// lifecycle-only but was sent to `reduce_step`. Also `plan_retry` with a bad `random`.
    pub const INVALID_EVENT: &str = "invalid_event";
    /// An inline `payload` exceeds [`INLINE_LIMIT_BYTES`](vlo_types::INLINE_LIMIT_BYTES).
    pub const PAYLOAD_TOO_LARGE: &str = "payload_too_large";
    /// The run is already closed (completed, failed, cancelled or continued); no further
    /// events are accepted.
    pub const RUN_CLOSED: &str = "run_closed";
    /// `started` arrived on a run whose `last_seq` is not `0`.
    pub const BAD_SEQ: &str = "bad_seq";
    /// The event names a step that is not open: never opened, or already pruned as terminal.
    pub const UNKNOWN_STEP: &str = "unknown_step";
    /// The step edge is not in the state machine, the step's kind differs from the event's,
    /// the event is for a future attempt, a retry skips an attempt, a signal lands on a step
    /// not awaiting one, or `started` arrives on a run that is not `created`.
    pub const ILLEGAL_TRANSITION: &str = "illegal_transition";
    /// The event is for an attempt the step has already moved past (a stale duplicate).
    pub const ALREADY_TERMINAL: &str = "already_terminal";
    /// A command is malformed: empty activity, workflow, signal name, channel or explicit id,
    /// or a timer with neither `fire_at_ms` nor `fire_in_ms`.
    pub const INVALID_COMMAND: &str = "invalid_command";
    /// A command names a step id that is already open.
    pub const DUPLICATE_STEP_ID: &str = "duplicate_step_id";
    /// A reduction issues `complete` / `continue_as_new` more than once.
    pub const MULTIPLE_COMPLETIONS: &str = "multiple_completions";
    /// A command follows `complete` / `continue_as_new` in the same reduction.
    pub const COMMANDS_AFTER_COMPLETION: &str = "commands_after_completion";
}

/// Result alias every kernel function returns; the error is always a [`KernelError`].
pub type KResult<T> = Result<T, KernelError>;

/// Build a [`KernelError`] with neither `seq` nor `step_id`.
pub fn err(code: &str, message: impl Into<String>) -> KernelError {
    KernelError {
        code: code.to_string(),
        message: message.into(),
        seq: None,
        step_id: None,
    }
}

/// Build a [`KernelError`] tagged with the step it concerns.
pub fn err_step(code: &str, message: impl Into<String>, step_id: &str) -> KernelError {
    KernelError {
        step_id: Some(step_id.to_string()),
        ..err(code, message)
    }
}

/// Build a [`KernelError`] tagged with the seq it concerns.
pub fn err_seq(code: &str, message: impl Into<String>, seq: u64) -> KernelError {
    KernelError {
        seq: Some(seq),
        ..err(code, message)
    }
}
