/**
 * Building the events the host submits, and telling them apart from the ones the kernel
 * emits.
 *
 * The journal holds both. Only *inputs* are re-fed on a re-fold; kernel outputs (a task
 * the reducer asked for, a signal wait, the `complete` marker) are recomputed by replaying
 * the inputs, so feeding them back would double-count. The partition below mirrors
 * `crates/kernel/src/classify.rs`: an event is an input exactly when `classify` routes it.
 */

import { randomBytes } from "node:crypto";
import type {
  Cause,
  Envelope,
  EventInput,
  KernelError,
  KernelResult,
  RunStatus,
  Status,
  Usage,
} from "../kernel/protocol.ts";
import {
  CANCEL_STEP_ID,
  FAIL_STEP_ID,
  NONDETERMINISM_STEP_ID,
  START_STEP_ID,
} from "../kernel/protocol.ts";
import { isTerminalRunStatus } from "../core/run-status.ts";
import { IllegalEvent } from "./errors.ts";

const INPUT_MARKERS: ReadonlySet<string> = new Set([
  START_STEP_ID,
  CANCEL_STEP_ID,
  FAIL_STEP_ID,
  NONDETERMINISM_STEP_ID,
]);

/** 32 lowercase hex characters, journaled so every replay sees the same randomness. */
export function randomHex(): string {
  return randomBytes(16).toString("hex");
}

export function isInputEvent(event: Pick<EventInput, "kind" | "status" | "step_id">): boolean {
  switch (event.kind) {
    case "marker":
      return INPUT_MARKERS.has(event.step_id);
    case "task":
      return event.status !== "scheduled";
    case "timer":
    case "signal":
      return event.status === "succeeded";
    case "child":
      return event.status === "succeeded" || event.status === "failed" || event.status === "cancelled";
  }
}

const ASSIGNED_BY_KERNEL = ["seq", "state_hash", "parent_run_id", "parent_step_id"] as const;

/** Drops the fields the kernel assigns, so a journaled envelope can be re-submitted. */
export function toEventInput(envelope: Envelope): EventInput {
  const input: Record<string, unknown> = { ...envelope };
  for (const field of ASSIGNED_BY_KERNEL) delete input[field];
  return input as unknown as EventInput;
}

interface Base {
  runId: string;
  nowMs: number;
}

function base(b: Base, rest: Omit<EventInput, "run_id" | "ts_ms" | "random">): EventInput {
  return { run_id: b.runId, ts_ms: b.nowMs, random: randomHex(), ...rest };
}

export function startedEvent(b: Base, inputJson: string): EventInput {
  return base(b, {
    step_id: START_STEP_ID,
    attempt: 0,
    kind: "marker",
    status: "succeeded",
    payload: inputJson,
  });
}

export function taskRunningEvent(b: Base, stepId: string, attempt: number): EventInput {
  return base(b, { step_id: stepId, attempt, kind: "task", status: "running" });
}

/** What an attempt spent, when the worker reported any. The kernel banks it as it folds. */
function spent(usage: Usage | undefined): { usage?: Usage } {
  return usage !== undefined ? { usage } : {};
}

export function taskSucceededEvent(
  b: Base,
  stepId: string,
  attempt: number,
  outputJson: string,
  schemaRef?: string,
  usage?: Usage,
): EventInput {
  return base(b, {
    step_id: stepId,
    attempt,
    kind: "task",
    status: "succeeded",
    payload: outputJson,
    ...(schemaRef !== undefined ? { schema_ref: schemaRef } : {}),
    ...spent(usage),
  });
}

export function taskFailedEvent(
  b: Base,
  stepId: string,
  attempt: number,
  cause: Cause,
  error: string,
  usage?: Usage,
): EventInput {
  return base(b, {
    step_id: stepId,
    attempt,
    kind: "task",
    status: "failed",
    cause,
    error,
    ...spent(usage),
  });
}

/** `attempt` names the *next* attempt; the payload carries the delay the kernel planned. */
export function taskRetryingEvent(
  b: Base,
  stepId: string,
  nextAttempt: number,
  cause: Cause,
  delayMs: number,
  error?: string,
  usage?: Usage,
): EventInput {
  return base(b, {
    step_id: stepId,
    attempt: nextAttempt,
    kind: "task",
    status: "retrying",
    cause,
    payload: JSON.stringify({ delay_ms: delayMs }),
    ...(error !== undefined ? { error } : {}),
    ...spent(usage),
  });
}

/** A due timer. The kernel reads the deadline from the step, so there is no payload. */
export function timerFiredEvent(b: Base, stepId: string): EventInput {
  return base(b, { step_id: stepId, attempt: 0, kind: "timer", status: "succeeded" });
}

export function signalEvent(b: Base, stepId: string, payloadJson: string): EventInput {
  return base(b, {
    step_id: stepId,
    attempt: 0,
    kind: "signal",
    status: "succeeded",
    payload: payloadJson,
  });
}

export function childEvent(
  b: Base,
  stepId: string,
  status: Status,
  outputJson: string | undefined,
): EventInput {
  return base(b, {
    step_id: stepId,
    attempt: 0,
    kind: "child",
    status,
    ...(outputJson !== undefined ? { payload: outputJson } : {}),
  });
}

export function cancelEvent(b: Base): EventInput {
  return base(b, {
    step_id: CANCEL_STEP_ID,
    attempt: 0,
    kind: "marker",
    status: "cancelled",
    cause: "user_cancel",
  });
}

/**
 * The reducer threw: `WorkflowFailure` and any other throw both land here. The event being
 * folded is rolled back with its transaction, so it rides along in the payload as evidence.
 */
export function failEvent(b: Base, message: string, trigger?: EventInput): EventInput {
  return base(b, {
    step_id: FAIL_STEP_ID,
    attempt: 0,
    kind: "marker",
    status: "failed",
    cause: "app_error",
    error: message,
    ...(trigger !== undefined ? { payload: JSON.stringify(trigger) } : {}),
  });
}

export function nondeterminismEvent(b: Base, detail: string): EventInput {
  return base(b, {
    step_id: NONDETERMINISM_STEP_ID,
    attempt: 0,
    kind: "marker",
    status: "failed",
    cause: "nondeterminism_detected",
    error: detail,
  });
}

/** A run that accepts no further events. */
export function isTerminalRun(status: RunStatus): boolean {
  return isTerminalRunStatus(status);
}

/** A child run's terminal status as the parent's `child` event sees it. */
export function childStatusOf(runStatus: RunStatus): Status | null {
  switch (runStatus) {
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/** Kernel calls are infallible-by-contract; a refusal is an `IllegalEvent` here. */
export function unwrap<T>(result: KernelResult<T>): T {
  if (result.ok) return result.value;
  throw new IllegalEvent(result.error);
}

/** Codes that mean "this event was already folded", i.e. an at-least-once redelivery. */
const DUPLICATE_CODES: ReadonlySet<string> = new Set([
  "unknown_step",
  "already_terminal",
  "bad_seq",
]);

export function isDuplicate(error: KernelError): boolean {
  return DUPLICATE_CODES.has(error.code);
}
