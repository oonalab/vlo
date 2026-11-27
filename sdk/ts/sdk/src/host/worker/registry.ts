/**
 * `defineWorker` — the activity implementations one process runs.
 *
 * A worker is a map from activity name to handler plus the queues it serves. It holds no
 * schemas: the host validates output against the registered `Activity` before it is folded,
 * so a worker and a host can be different processes on different deploys.
 */

import type { Json } from "../../kernel/protocol.ts";
import { DEFAULT_QUEUE } from "../../core/activity.ts";

/** Authoring form of `Usage` (camelCase, all optional); the wire form is snake_case. */
export interface UsageInput {
  tokens?: number;
  costMicroUsd?: number;
  cpuMs?: number;
}

/** What a handler gets beside its input: identity of the attempt and the controls for it. */
export interface TaskContext {
  /** Task id, `${run_id}:${step_id}`; stable across attempts. */
  taskId: string;
  /** The run the task belongs to. */
  runId: string;
  /** Attempt number, starting at 1. `${taskId}:${attempt}` is the idempotency key. */
  attempt: number;
  /** Extends the lease. Rejects once the lease is gone, so a long task can stop. */
  heartbeat(): Promise<void>;
  /**
   * Accumulates what this attempt spent. The total travels with the attempt's result, the
   * kernel banks it, and every reducer event then carries the run's `usage_total`.
   * Reported on a failed attempt too: tokens burned before a throw are still spent.
   */
  reportUsage(usage: UsageInput): void;
  /** Aborted when the lease is lost, the activity times out, or the worker shuts down. */
  signal: AbortSignal;
}

/**
 * The implementation of one activity. `input` has already passed the activity's input
 * schema; the return value is validated against its output schema by the host. A throw
 * fails the attempt as retryable; aborting on `ctx.signal` is how a handler cooperates
 * with a timeout, a lost lease or a shutdown.
 */
export type ActivityHandler<I = Json, O = unknown> = (
  input: I,
  ctx: TaskContext,
) => O | Promise<O>;

/** Handler inputs are contravariant, so `never` accepts any concretely typed handler. */
export type ActivityImpls = Record<string, ActivityHandler<never, unknown>>;

/** A defined worker: the value {@link defineWorker} returns and the host or config loader registers. */
export interface Worker {
  /** Discriminator the config loader uses to find workers among a module's exports. */
  readonly kind: "worker";
  /** Queues this worker serves. */
  readonly queues: readonly string[];
  /** Handlers by activity name. */
  readonly handlers: ReadonlyMap<string, ActivityHandler<Json, unknown>>;
}

/** Options for {@link defineWorker}. */
export interface WorkerOptions {
  /** Queues the worker serves. Default `[DEFAULT_QUEUE]`. */
  queues?: readonly string[];
}

/**
 * Defines a worker: a map from activity name to {@link ActivityHandler} plus the queues it
 * serves. Passed to `createHost({ workers })` for in-process execution, `runPullWorker` for
 * long-polling, or found by the config loader's `workers` globs.
 *
 * The worker holds no schemas; validation happens in the reducer (input) and on the host
 * (output). Throws a `TypeError` when `impls` is empty.
 *
 * @example
 * ```ts
 * import { defineWorker } from "@oona/vlo";
 *
 * export default defineWorker(
 *   {
 *     "example.plan": (input: { n: number }) => ({
 *       items: Array.from({ length: input.n }, (_, i) => `item-${i}`),
 *     }),
 *     "example.work": async (input: { item: string }, ctx) => {
 *       await ctx.heartbeat();
 *       ctx.reportUsage({ tokens: 12 });
 *       return { upper: input.item.toUpperCase() };
 *     },
 *   },
 *   { queues: ["default"] },
 * );
 * ```
 */
export function defineWorker(impls: ActivityImpls, options: WorkerOptions = {}): Worker {
  const handlers = new Map<string, ActivityHandler<Json, unknown>>();
  for (const [name, handler] of Object.entries(impls)) {
    handlers.set(name, handler as ActivityHandler<Json, unknown>);
  }
  if (handlers.size === 0) throw new TypeError("defineWorker: no activity implementations given");

  return {
    kind: "worker",
    queues: options.queues ?? [DEFAULT_QUEUE],
    handlers,
  };
}

/**
 * Wraps a handler so attempts after the first receive `shape(input, attempt)` instead of the
 * journaled input. Use it when repeating the same ask would fail the same way — a model
 * looping on a long prompt, say — and a smaller or different ask has a chance.
 *
 * The journaled task input is untouched; only this process's view of it changes, and
 * `attempt` is journaled, so the same attempt always sees the same input. `shape` must be
 * pure. The shaped input is not re-validated against the activity's input schema.
 *
 * @example
 * ```ts
 * defineWorker({
 *   "brand.synthesize": withRetryInput(synthesize, (input) => ({ ...input, compact: true })),
 * });
 * ```
 */
export function withRetryInput<I, O>(
  handler: ActivityHandler<I, O>,
  shape: (input: I, attempt: number) => I,
): ActivityHandler<I, O> {
  return (input, ctx) => handler(ctx.attempt > 1 ? shape(input, ctx.attempt) : input, ctx);
}

/** The first worker in this process that serves both the queue and the activity. */
export function findWorker(
  workers: readonly Worker[],
  queue: string,
  activity: string,
): Worker | undefined {
  return workers.find((w) => w.queues.includes(queue) && w.handlers.has(activity));
}
