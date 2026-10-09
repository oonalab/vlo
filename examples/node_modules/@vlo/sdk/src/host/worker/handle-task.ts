/**
 * Running one task. The worker side of the contract: call the handler, keep the lease
 * alive while it runs, report exactly one terminal result.
 *
 * "Exactly one" is enforced here rather than trusted: a timeout, a throw and a late return
 * all race for the same attempt, and only the first of them is allowed to report. The others
 * are dropped, which is what lets `timeout_ms` abort a handler that ignores `ctx.signal`
 * without the host ever seeing two results for one attempt.
 */

import type { Cause, Usage } from "../../kernel/protocol.ts";
import type { UsageInput, Worker } from "./registry.ts";
import type { PushedTask } from "../transport/types.ts";

/** Where a result goes: back into this process, or over HTTP to the host that pushed. */
export interface TaskReporter {
  /** Reports the attempt's output. */
  complete(taskId: string, attempt: number, output: unknown, usage?: Usage): Promise<void>;
  /** Reports a failure; `retryable: false` skips the retry policy. `cause` defaults to `app_error`. */
  fail(
    taskId: string,
    attempt: number,
    error: string,
    retryable: boolean,
    usage?: Usage,
    cause?: Cause,
  ): Promise<void>;
  /** Extends the lease. Rejects once the lease is gone. */
  heartbeat(taskId: string, attempt: number): Promise<void>;
}

/** Knobs for {@link handleTask}. */
export interface HandleTaskOptions {
  /** The worker's own lifetime. Aborting it tells in-flight handlers to stop. */
  signal?: AbortSignal;
}

/**
 * Runs one pushed task on a worker and reports exactly one terminal result. Heartbeats every
 * `heartbeat_ms`; a refused heartbeat, `timeout_ms` elapsing or `options.signal` aborting
 * all abort the handler's `ctx.signal`. A handler throw is reported as a retryable failure;
 * a missing handler as a non-retryable one. Resolves once the result was reported, and
 * rejects only when the reporter itself fails.
 */
export async function handleTask(
  worker: Worker,
  task: PushedTask,
  reporter: TaskReporter,
  options: HandleTaskOptions = {},
): Promise<void> {
  const handler = worker.handlers.get(task.activity.name);
  if (handler === undefined) {
    await reporter.fail(
      task.task_id,
      task.attempt,
      `no handler for activity "${task.activity.name}"`,
      false,
    );
    return;
  }

  const spend = usageTally();
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  options.signal?.addEventListener("abort", stop, { once: true });

  let reported = false;
  /** The first terminal result wins; anything later is a loser of the race. */
  const report = (send: () => Promise<void>): Promise<void> => {
    if (reported) return Promise.resolve();
    reported = true;
    return send();
  };

  const heartbeat = (): Promise<void> => reporter.heartbeat(task.task_id, task.attempt);
  const beat =
    task.heartbeat_ms > 0
      ? setInterval(() => {
          // A refused heartbeat means the lease is gone; tell the handler to stop.
          heartbeat().catch(stop);
        }, task.heartbeat_ms)
      : undefined;
  beat?.unref();

  const finished = (async () => {
    try {
      const output = await handler(task.input, {
        taskId: task.task_id,
        runId: task.run_id,
        attempt: task.attempt,
        heartbeat,
        reportUsage: spend.add,
        signal: controller.signal,
      });
      await report(() => reporter.complete(task.task_id, task.attempt, output, spend.total()));
    } catch (error) {
      await report(() =>
        reporter.fail(task.task_id, task.attempt, messageOf(error), true, spend.total()),
      );
    }
  })();

  try {
    await raceTimeout(finished, task.timeout_ms, async () => {
      stop();
      await report(() =>
        reporter.fail(
          task.task_id,
          task.attempt,
          `activity "${task.activity.name}" timed out after ${String(task.timeout_ms)} ms`,
          true,
          spend.total(),
          "timeout",
        ),
      );
    });
  } finally {
    if (beat !== undefined) clearInterval(beat);
    options.signal?.removeEventListener("abort", stop);
  }
}

/**
 * Resolves on whichever comes first: the handler settling, or the timeout reporting. A
 * handler that ignores `ctx.signal` keeps running, but it no longer owns the attempt.
 */
function raceTimeout(
  finished: Promise<void>,
  timeoutMs: number | undefined,
  onTimeout: () => Promise<void>,
): Promise<void> {
  if (timeoutMs === undefined || timeoutMs <= 0) return finished;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout().then(resolve, reject);
    }, timeoutMs);
    timer.unref();
    finished.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

interface UsageTally {
  add(usage: UsageInput): void;
  /** Undefined until something was reported, so an event carries no meaningless zeros. */
  total(): Usage | undefined;
}

function usageTally(): UsageTally {
  const total: Usage = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };
  let touched = false;
  return {
    add(usage) {
      touched = true;
      total.cpu_ms += whole(usage.cpuMs);
      total.tokens += whole(usage.tokens);
      total.cost_micro_usd += whole(usage.costMicroUsd);
    },
    total: () => (touched ? { ...total } : undefined),
  };
}

/** `Usage` is hashed into the kernel state, so it is integers only and never negative. */
function whole(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
