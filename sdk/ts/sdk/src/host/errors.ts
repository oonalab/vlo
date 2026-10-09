/**
 * Host errors. Every kernel or journal failure the host can act on becomes one of these,
 * so routes map to status codes by `instanceof` rather than by string matching.
 */

import type { EventInput, KernelError } from "../kernel/protocol.ts";

/**
 * Base of every error the host maps to an HTTP response. The router turns one into
 * `{ error: { code, message } }` with `status`; anything else is a 500 `internal`.
 */
export class VloError extends Error {
  /** HTTP status the router answers with. */
  readonly status: number;
  /** Stable machine-readable code, e.g. `run_not_found`. */
  readonly code: string;

  /** `name` is set to the concrete subclass name. */
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

/** No run with that id. `run_not_found`, 404. */
export class RunNotFound extends VloError {
  /** @param runId The id that was looked up; kept on the error. */
  constructor(readonly runId: string) {
    super("run_not_found", `no run "${runId}"`, 404);
  }
}

/** No task with that id. `task_not_found`, 404. */
export class TaskNotFound extends VloError {
  /** @param taskId The id that was looked up; kept on the error. */
  constructor(readonly taskId: string) {
    super("task_not_found", `no task "${taskId}"`, 404);
  }
}

/**
 * The run already ended, so a non-task event (a signal, say) cannot be applied.
 * `run_terminal`, 409. A late task result on an ended run is a duplicate, not this.
 */
export class RunTerminal extends VloError {
  /** `status` is the terminal status the run is in. */
  constructor(runId: string, status: string) {
    super("run_terminal", `run "${runId}" is ${status}; no further events are accepted`, 409);
  }
}

/** The kernel refused the event: a duplicate, a stale attempt or an illegal transition. */
export class IllegalEvent extends VloError {
  /** The kernel's refusal, verbatim. Its `code` becomes this error's `code`. */
  readonly kernelError: KernelError;

  /** Code is the kernel's (`unknown_step`, `bad_seq`, `illegal_transition`, …), status 409. */
  constructor(error: KernelError) {
    super(error.code, error.message, 409);
    this.kernelError = error;
  }
}

/**
 * The checkpoint or the re-fold disagreed with the journal. The run is failed first: the
 * `nondeterminism` marker it records carries `cause: "nondeterminism_detected"`, which is the
 * kernel's `Cause` value and stays as it is. This error's own code is `refold_mismatch`.
 */
export class Nondeterminism extends VloError {
  /** `refold_mismatch`, 409. */
  constructor(
    /** The run that diverged. */
    readonly runId: string,
    /** The first journal seq the replay disagreed at; 0 when the journal holds nothing foldable. */
    readonly seq: number,
    detail: string,
  ) {
    super("refold_mismatch", `run "${runId}" diverged at seq ${seq}: ${detail}`, 409);
  }
}

/**
 * The reducer threw, or the host could not honour what it asked for. `applyEvent` swallows
 * this and records a `fail` marker with `cause: "app_error"` (the kernel's `Cause` value; this
 * error's own code is `reducer_failed`). Also raised when a `spawn` or `continue_as_new`
 * names a workflow this host has not registered.
 */
export class ReducerFailed extends VloError {
  /** The reducer's own message, without the folding context; journaled as the `fail` marker's `error`. */
  readonly reason: string;

  /** `reducer_failed`, 409. Callers of `applyEvent` never see it; the run is failed instead. */
  constructor(
    /** The run whose reducer threw. */
    readonly runId: string,
    message: string,
    /** The event being folded when the reducer threw; journaled on the `fail` marker. */
    readonly trigger?: EventInput,
    /** Default: `message`. */
    reason?: string,
  ) {
    super("reducer_failed", message, 409);
    this.reason = reason ?? message;
  }
}

/** Kernel refusals that mean the step an event named is no longer open. */
const STEP_GONE: ReadonlySet<string> = new Set([
  "unknown_step",
  "illegal_transition",
  "already_terminal",
]);

/**
 * True when `error` says the step an event was aimed at is closed for good: the run ended, or
 * the kernel refused the event because the step is unknown or past that transition. A timer
 * or a signal wait in that state has nothing left to wake, so its row is retired, not retried.
 */
export function isStepGone(error: unknown): boolean {
  if (error instanceof RunTerminal) return true;
  return error instanceof IllegalEvent && STEP_GONE.has(error.kernelError.code);
}

/** The host was asked to run a workflow it does not have registered. */
export class WorkflowRejected extends VloError {
  /** `unknown_workflow`, 400. */
  constructor(name: string) {
    super("unknown_workflow", `no workflow "${name}" is registered on this host`, 400);
  }
}

/** Bearer token or push signature missing or wrong. `unauthorized`, 401. */
export class Unauthorized extends VloError {
  /** Message defaults to `missing or invalid credentials`. */
  constructor(message = "missing or invalid credentials") {
    super("unauthorized", message, 401);
  }
}

/** Malformed body, query or signal payload. `bad_request`, 400. */
export class BadRequest extends VloError {
  /** `bad_request`, 400. */
  constructor(message: string) {
    super("bad_request", message, 400);
  }
}

/** The worker's lease is gone: stop working, someone else owns the attempt. */
export class LeaseLost extends VloError {
  /** `lease_lost`, 410. */
  constructor(taskId: string, attempt: number) {
    super("lease_lost", `task "${taskId}" attempt ${attempt} no longer holds its lease`, 410);
  }
}
