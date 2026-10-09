/**
 * `runPullWorker` — a worker process that asks a host for work instead of being pushed to.
 *
 * Everything after the poll is the push path unchanged: `handleTask` runs the activity and
 * `remoteReporter` calls the result back over the same three verbs. Only the delivery differs,
 * which is what keeps a pull queue a deployment choice rather than a second execution model.
 */

import { randomBytes } from "node:crypto";
import type { PushedTask } from "../transport/types.ts";
import { handleTask } from "./handle-task.ts";
import type { Worker } from "./registry.ts";
import { remoteReporter, type FetchLike } from "./reporters.ts";

const DEFAULT_WAIT_MS = 20_000;
const DEFAULT_CONCURRENCY = 4;
const MAX_PER_POLL = 10;
/** Backoff after a failed poll, so an unreachable host is not hammered. */
const RETRY_MS = 1_000;
/** Pause after an empty zero-wait poll. */
const IDLE_MS = 50;

export interface PullWorkerOptions {
  /** The host's base URL, e.g. `https://vlo.example.com`. */
  baseUrl: string;
  /** Control-plane bearer token; also sent when reporting results. */
  token?: string;
  /** The activity implementations to run. */
  worker: Worker;
  /** Queues to poll, round-robin. Defaults to the queues the worker declares. */
  queues?: readonly string[];
  /** How long the host may hold a poll open with no work. Capped at 25 s by the host. */
  waitMs?: number;
  /** Tasks run at once. Default 4; at most 10 are requested per poll. */
  concurrency?: number;
  /** Stops polling when aborted; in-flight handlers see it on `ctx.signal`. */
  signal?: AbortSignal;
  /** Sent as `worker_id` and recorded on the task. Default `vlo-pull-<8 hex>`. */
  workerId?: string;
  /** `fetch` implementation. Default `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Called for a poll that failed; the loop backs off and carries on. */
  onError?: (error: unknown) => void;
}

/**
 * Runs until `signal` aborts, then resolves once the tasks in flight have reported. Throws
 * a `TypeError` when there is no queue to poll. A failed poll goes to `onError` and the loop
 * retries after 1 s. Runs on the worker side; the host only needs the `api` role.
 *
 * @example
 * ```ts
 * import { defineWorker, runPullWorker } from "@vlo/sdk/host";
 *
 * const abort = new AbortController();
 * const loop = runPullWorker({
 *   baseUrl: "https://vlo.example.com",
 *   token: "control-plane-token",
 *   worker: defineWorker(
 *     { "pull.render": (input: { clip: string }) => ({ rendered: input.clip.toUpperCase() }) },
 *     { queues: ["media"] },
 *   ),
 *   waitMs: 5_000,
 *   signal: abort.signal,
 *   onError: (error) => console.error(error),
 * });
 * process.once("SIGTERM", () => abort.abort());
 * await loop;
 * ```
 */
export async function runPullWorker(options: PullWorkerOptions): Promise<void> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const queues = options.queues ?? options.worker.queues;
  if (queues.length === 0) throw new TypeError("runPullWorker: no queues to poll");

  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const workerId = options.workerId ?? `vlo-pull-${randomBytes(4).toString("hex")}`;
  const signal = options.signal;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const inFlight = new Set<Promise<void>>();
  const aborted = (): boolean => signal?.aborted === true;

  let next = 0;
  while (!aborted()) {
    if (inFlight.size >= concurrency) {
      await Promise.race(inFlight);
      continue;
    }

    const queue = queues[next % queues.length] as string;
    next += 1;

    let tasks: PushedTask[];
    try {
      tasks = await poll(fetchImpl, {
        baseUrl,
        queue,
        workerId,
        waitMs,
        max: Math.min(concurrency - inFlight.size, MAX_PER_POLL),
        ...(options.token !== undefined ? { token: options.token } : {}),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (error) {
      if (aborted()) break;
      options.onError?.(error);
      await sleep(RETRY_MS, signal);
      continue;
    }

    if (tasks.length === 0) {
      // A long poll already paid its wait on the host; a zero-wait one would spin.
      if (waitMs === 0) await sleep(IDLE_MS, signal);
      continue;
    }

    for (const task of tasks) {
      const reporter = remoteReporter(completeUrl(baseUrl, task), options.token, fetchImpl);
      // The worker's own signal reaches the handler, so a shutdown tells in-flight work to stop.
      const running = handleTask(options.worker, task, reporter, {
        ...(signal !== undefined ? { signal } : {}),
      })
        .catch((error: unknown) => options.onError?.(error))
        .finally(() => inFlight.delete(running));
      inFlight.add(running);
    }
  }

  await Promise.all(inFlight);
}

interface PollArgs {
  baseUrl: string;
  queue: string;
  workerId: string;
  waitMs: number;
  max: number;
  token?: string;
  signal?: AbortSignal;
}

async function poll(fetchImpl: FetchLike, a: PollArgs): Promise<PushedTask[]> {
  const response = await fetchImpl(`${a.baseUrl}/v1/tasks/poll`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(a.token !== undefined ? { authorization: `Bearer ${a.token}` } : {}),
    },
    body: JSON.stringify({
      queue: a.queue,
      worker_id: a.workerId,
      wait_ms: a.waitMs,
      max: a.max,
    }),
    ...(a.signal !== undefined ? { signal: a.signal } : {}),
  });
  if (!response.ok) {
    throw new Error(`poll ${a.queue} failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { tasks?: PushedTask[] };
  return body.tasks ?? [];
}

/** The host fills `complete_url` when it knows its own URL; otherwise we know it. */
function completeUrl(baseUrl: string, task: PushedTask): string {
  return task.complete_url ?? `${baseUrl}/v1/tasks/${encodeURIComponent(task.task_id)}`;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    timer.unref();
    signal?.addEventListener("abort", done, { once: true });
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });
}
