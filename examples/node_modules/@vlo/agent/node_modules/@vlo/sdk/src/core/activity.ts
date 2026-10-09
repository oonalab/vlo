/**
 * Activity and signal definitions: a name, Zod schemas, a retry policy, and a content hash
 * derived from all three. The hash is the version: `name@hash` is the `schema_ref` carried
 * on every event, so a run can span a schema upgrade.
 */

import { z } from "zod";
import type { Json, RetryPolicy } from "../kernel/protocol.ts";
import { contentHash } from "./hash.ts";
import { projectSchema, SCHEMA_HASH_VERSION } from "./schema-projection.ts";

/**
 * Retry policy an activity gets when {@link ActivityOptions.retry} is omitted: three
 * attempts, exponential backoff from 1 s to a 10 min cap, factor 2, full jitter. Each
 * field is also the fallback for any {@link RetryOptions} field left unset.
 */
export const DEFAULT_RETRY: RetryPolicy = {
  max_attempts: 3,
  backoff: "exponential",
  initial_ms: 1_000,
  max_ms: 600_000,
  factor: 2,
  jitter: "full",
};

/**
 * Queue an activity is dispatched on when {@link ActivityOptions.queue} is omitted, and the
 * queue a worker serves when {@link WorkerOptions.queues} is omitted.
 */
export const DEFAULT_QUEUE = "default";

/** Lease a worker holds before it must heartbeat. Long tasks heartbeat, they do not raise this. */
export const DEFAULT_LEASE_MS = 60_000;

/**
 * Authoring form of {@link RetryPolicy} (camelCase, all optional); the wire form is
 * snake_case. Every omitted field falls back to {@link DEFAULT_RETRY}.
 */
export interface RetryOptions {
  /** Attempts in total, the first one included. Default `3`. */
  maxAttempts?: number;
  /** `"fixed"` waits `initialMs` every time; `"exponential"` multiplies it by `factor` per attempt. Default `"exponential"`. */
  backoff?: RetryPolicy["backoff"];
  /** Delay before the second attempt, in milliseconds. Default `1_000`. */
  initialMs?: number;
  /** Ceiling on any single delay, in milliseconds. Default `600_000`. */
  maxMs?: number;
  /** Growth multiplier for exponential backoff; a value ≤ 1 behaves like fixed. Default `2`. */
  factor?: number;
  /** `"full"` scales each delay by a journaled random fraction; `"none"` uses it as is. Default `"full"`. */
  jitter?: RetryPolicy["jitter"];
}

function toRetryPolicy(options: RetryOptions | undefined): RetryPolicy {
  const o = options ?? {};
  return {
    max_attempts: o.maxAttempts ?? DEFAULT_RETRY.max_attempts,
    backoff: o.backoff ?? DEFAULT_RETRY.backoff,
    initial_ms: o.initialMs ?? DEFAULT_RETRY.initial_ms,
    max_ms: o.maxMs ?? DEFAULT_RETRY.max_ms,
    factor: o.factor ?? DEFAULT_RETRY.factor,
    jitter: o.jitter ?? DEFAULT_RETRY.jitter,
  };
}

/** What {@link activity} needs: the two Zod schemas plus optional dispatch knobs. */
export interface ActivityOptions<I extends z.ZodType, O extends z.ZodType> {
  /** Schema of the task input. `cmd.task` validates against it before the command leaves the reducer. */
  input: I;
  /** Schema of the handler's return value. The host validates against it before folding `task_done`. */
  output: O;
  /** Retry policy; see {@link RetryOptions}. Part of the content hash. Default {@link DEFAULT_RETRY}. */
  retry?: RetryOptions;
  /** Queue the task is dispatched on. Default {@link DEFAULT_QUEUE}. Outside the content hash. */
  queue?: string;
  /** Lease a worker holds on an attempt before it must heartbeat, in milliseconds. Default {@link DEFAULT_LEASE_MS}. Outside the content hash. */
  leaseMs?: number;
  /**
   * Wall-clock budget for one attempt. The worker aborts the handler at it and reports
   * `cause: "timeout"`; the host reaps the attempt if the worker never answers at all.
   *
   * Deliberately outside the content hash: a timeout is an operational knob, not part of the
   * activity's contract, so tuning it must not version the schema out from under live runs.
   */
  timeoutMs?: number;
}

/**
 * A defined activity: the value {@link activity} returns, passed to `cmd.task`, {@link step}
 * and {@link fanOut}. `I` and `O` are the inferred input and output types.
 */
export interface Activity<I = unknown, O = unknown> {
  /** Discriminator the config loader uses to find activities among a module's exports. */
  readonly kind: "activity";
  /** The name given to {@link activity}; the key a worker registers its handler under. */
  readonly name: string;
  /** Content hash of `name`, both JSON schemas and the retry policy. It is the version. */
  readonly hash: string;
  /** `${name}@${hash}` — the `schema_ref` on the wire. */
  readonly schemaRef: string;
  /** Input schema, as given. */
  readonly input: z.ZodType<I>;
  /** Output schema, as given. */
  readonly output: z.ZodType<O>;
  /** Resolved retry policy in wire form. */
  readonly retry: RetryPolicy;
  /** Queue tasks are dispatched on. */
  readonly queue: string;
  /** Lease per attempt, in milliseconds. */
  readonly leaseMs: number;
  /** Per-attempt wall-clock budget, in milliseconds; absent when none was set. */
  readonly timeoutMs?: number;
  /** JSON Schema of both schemas, as registered with the host and used for the hash. */
  readonly jsonSchema: { input: Json; output: Json };
}

/**
 * A defined signal: the value {@link signal} returns, passed to `cmd.awaitSignal`,
 * `cmd.awaitHuman` and {@link waitFor}. `T` is the inferred payload type.
 */
export interface SignalDef<T = unknown> {
  /** Discriminator the config loader uses to find signals among a module's exports. */
  readonly kind: "signal";
  /** The name given to {@link signal}; the name a sender delivers the signal under. */
  readonly name: string;
  /** Content hash of `name` and the JSON schema. It is the version. */
  readonly hash: string;
  /** `${name}@${hash}` — the `schema_ref` on the wire. */
  readonly schemaRef: string;
  /** Payload schema, as given. A host that has the signal registered validates inbound payloads against it. */
  readonly schema: z.ZodType<T>;
  /** JSON Schema of `schema`, as registered with the host and used for the hash. */
  readonly jsonSchema: Json;
}

/**
 * Defines an activity: a named unit of work a worker implements and a reducer requests
 * with `cmd.task`.
 *
 * The content hash covers `name`, both schemas (as JSON Schema, projected by
 * {@link projectSchema} so annotations such as `description` and `default` are
 * hash-neutral) and the resolved retry policy, so changing any of them yields a new
 * `schemaRef`; `queue`, `leaseMs` and `timeoutMs` are operational and hash-neutral. Runs
 * pin the `schemaRef` per event, so old and new versions coexist.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { activity } from "@vlo/sdk";
 *
 * export const work = activity("example.work", {
 *   input: z.object({ item: z.string() }),
 *   output: z.object({ upper: z.string() }),
 *   retry: { maxAttempts: 3 },
 *   queue: "default",
 *   timeoutMs: 30_000,
 * });
 * ```
 */
export function activity<I extends z.ZodType, O extends z.ZodType>(
  name: string,
  options: ActivityOptions<I, O>,
): Activity<z.infer<I>, z.infer<O>> {
  const retry = toRetryPolicy(options.retry);
  const jsonSchema = {
    input: toJsonSchema(options.input),
    output: toJsonSchema(options.output),
  };
  const hash = contentHash({
    v: SCHEMA_HASH_VERSION,
    name,
    input: projectSchema(jsonSchema.input),
    output: projectSchema(jsonSchema.output),
    retry,
  });

  return {
    kind: "activity",
    name,
    hash,
    schemaRef: `${name}@${hash}`,
    // Zod's ZodType is invariant in its internals, so `I extends z.ZodType` does not
    // structurally satisfy `z.ZodType<z.infer<I>>` even though its output type is exactly that.
    input: options.input as z.ZodType<z.infer<I>>,
    output: options.output as z.ZodType<z.infer<O>>,
    retry,
    queue: options.queue ?? DEFAULT_QUEUE,
    leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    jsonSchema,
  };
}

/**
 * Defines a signal: a named, typed message a run can park on with `cmd.awaitSignal`,
 * `cmd.awaitHuman` or {@link waitFor}, delivered from outside through the host's API.
 *
 * The content hash covers `name` and the schema as JSON Schema, projected the same way as
 * an activity's. A host that has the definition registered rejects an inbound payload the
 * schema does not accept.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { signal } from "@vlo/sdk";
 *
 * export const approve = signal("example.approve", z.object({ by: z.string() }));
 * ```
 */
export function signal<S extends z.ZodType>(name: string, schema: S): SignalDef<z.infer<S>> {
  const jsonSchema = toJsonSchema(schema);
  const hash = contentHash({ v: SCHEMA_HASH_VERSION, name, schema: projectSchema(jsonSchema) });

  return {
    kind: "signal",
    name,
    hash,
    schemaRef: `${name}@${hash}`,
    schema: schema as z.ZodType<z.infer<S>>,
    jsonSchema,
  };
}

function toJsonSchema(schema: z.ZodType): Json {
  return z.toJSONSchema(schema) as unknown as Json;
}
