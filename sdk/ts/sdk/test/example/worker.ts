/**
 * The example worker: implementations for `plan`, `work` and `finish`, plus the knobs the
 * host tests need — a one-shot failure toggle, a peak-concurrency counter, and dedupe on
 * the attempt's idempotency key so a re-push can be told apart from a re-execution.
 */

import { defineWorker, type Worker } from "../../src/host.ts";

export interface ExampleWorker {
  worker: Worker;
  /** Makes the next call to `activity` throw once. */
  failNext(activity: string): void;
  /** Highest number of handlers that ran at the same time. */
  peakConcurrency(): number;
  /** One entry per handler body actually executed, as `taskId:attempt`. */
  executions(): string[];
}

export interface ExampleWorkerOptions {
  /** How long `work` takes, so overlapping dispatches are observable. */
  workMs?: number;
  /** How long `plan` takes; useful for racing a re-push against a first execution. */
  planMs?: number;
  queues?: string[];
}

export function exampleWorker(options: ExampleWorkerOptions = {}): ExampleWorker {
  const workMs = options.workMs ?? 20;
  const planMs = options.planMs ?? 0;
  const failing = new Set<string>();
  const executed: string[] = [];
  const memo = new Map<string, Promise<unknown>>();
  let inFlight = 0;
  let peak = 0;

  /**
   * Runs `body` once per idempotency key. The *promise* is memoised, not its value, so a
   * re-push that arrives while the first execution is still running joins it instead of
   * starting a second one — which is exactly what a real idempotent worker has to do.
   */
  const once = <T>(key: string, body: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key);
    if (hit !== undefined) return hit as Promise<T>;

    executed.push(key);
    const running = (async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await body();
      } finally {
        inFlight -= 1;
      }
    })();
    memo.set(key, running);
    return running;
  };

  const guard = (activity: string): void => {
    if (!failing.delete(activity)) return;
    throw new Error(`${activity} was told to fail once`);
  };

  const worker = defineWorker(
    {
      "example.plan": (input: { n: number }, ctx) =>
        once(`${ctx.taskId}:${ctx.attempt}`, async () => {
          guard("example.plan");
          await sleep(planMs);
          return { items: Array.from({ length: input.n }, (_, i) => `item-${i}`) };
        }),

      "example.work": (input: { item: string }, ctx) =>
        once(`${ctx.taskId}:${ctx.attempt}`, async () => {
          guard("example.work");
          await sleep(workMs);
          return { upper: input.item.toUpperCase() };
        }),

      "example.finish": (input: { uppers: string[]; approvedBy: string }, ctx) =>
        once(`${ctx.taskId}:${ctx.attempt}`, async () => {
          guard("example.finish");
          return { report: `${input.uppers.join(",")} approved by ${input.approvedBy}` };
        }),
    },
    { queues: options.queues ?? ["default"] },
  );

  return {
    worker,
    failNext: (activity) => failing.add(activity),
    peakConcurrency: () => peak,
    executions: () => [...executed],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
