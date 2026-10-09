/**
 * Fixtures for the conformance suite: a controllable clock and the smallest
 * well-formed write-sets a journal has to accept. Kernel-independent — hashes
 * are opaque strings here, because journals never interpret them.
 */

import type { Envelope, NewTask, RetryPolicy, RunStatus, Transition } from "../kernel/protocol.ts";
import type { NewRunRow } from "./types.ts";

/** A clock a test moves by hand; `now` is what a host built with `now: clock.now` sees. */
export interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
  /** Moves the clock forward by `ms` milliseconds. Never runs backwards. */
  advance(ms: number): void;
}

/**
 * A {@link Clock} that starts at `startMs` and only moves when `advance` is called, so
 * leases, timers and timeouts expire exactly when a test says so.
 *
 * @example
 * ```ts
 * import { fakeClock } from "@vlo/sdk/testing";
 *
 * const clock = fakeClock(1_700_000_000_000);
 * const host = createHost({
 *   journal: "sqlite://:memory:",
 *   workflows: [workflow],
 *   now: clock.now,
 *   dispatcher: { tickMs: 10 },
 * });
 * await host.start();
 * clock.advance(60_001); // one whole default lease and a millisecond
 * ```
 */
export function fakeClock(startMs: number): Clock {
  let current = startMs;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

export const T0 = 1_700_000_000_000;

const RETRY: RetryPolicy = {
  max_attempts: 3,
  backoff: "exponential",
  initial_ms: 1_000,
  max_ms: 60_000,
  factor: 2,
  jitter: "full",
};

let counter = 0;

export const nextRunId = (): string =>
  `run-${++counter}-${Math.random().toString(36).slice(2, 8)}`;

export function newRun(runId: string, workflow = "example"): NewRunRow {
  return { run_id: runId, workflow, component_digest: "digest-1", status: "created" };
}

export function event(runId: string, seq: number): Envelope {
  return {
    run_id: runId,
    seq,
    step_id: `step-${seq}`,
    attempt: 1,
    kind: "marker",
    status: "succeeded",
    ts_ms: T0 + seq,
    random: "0".repeat(32),
    state_hash: `hash-${seq}`,
  };
}

export function newTask(
  runId: string,
  stepId: string,
  attempt = 1,
  queue = "default",
  timeoutMs?: number,
): NewTask {
  return {
    task_id: `${runId}:${stepId}`,
    step_id: stepId,
    attempt,
    activity: "echo",
    queue,
    input: { stepId },
    idempotency_key: `${runId}:${stepId}:${attempt}`,
    retry: RETRY,
    lease_ttl_ms: 30_000,
    ...(timeoutMs !== undefined ? { timeout_ms: timeoutMs } : {}),
  };
}

export interface TransitionParts {
  /** Run status after the event. Default `running`. */
  status?: RunStatus;
  tasks?: NewTask[];
  task_updates?: Transition["task_updates"];
  timers?: Transition["timers"];
  signal_waits?: Transition["signal_waits"];
  /** Set together with `status: "continued"` to shape a `continue_as_new` write-set. */
  continue_as_new?: Transition["continue_as_new"];
}

/** A minimal well-formed write-set carrying one event at `seq`. */
export function transitionAt(
  runId: string,
  seq: number,
  parts: TransitionParts = {},
): Transition {
  const status = parts.status ?? "running";
  return {
    run: { status, last_seq: seq },
    kernel_state: {
      v: 1,
      status,
      step_no: seq,
      steps: {},
      closed_steps: 0,
      usage_total: { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 },
    },
    state: JSON.stringify({ seq }),
    state_hash: `hash-${seq}`,
    state_inline: true,
    events: [event(runId, seq)],
    tasks: parts.tasks ?? [],
    task_updates: parts.task_updates ?? [],
    timers: parts.timers ?? [],
    spawns: [],
    signal_waits: parts.signal_waits ?? [],
    emits: [],
    ...(parts.continue_as_new !== undefined ? { continue_as_new: parts.continue_as_new } : {}),
  };
}
