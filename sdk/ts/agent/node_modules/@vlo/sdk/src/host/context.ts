/**
 * Everything the host's moving parts share: the journal, the blob store, the kernel and
 * the registries. Passed explicitly so that `transition`, `dispatcher` and the routes stay
 * plain functions with no hidden globals.
 */

import type { EventEmitter } from "node:events";
import type { BlobStore } from "../blob/types.ts";
import type { Workflow } from "../core/workflow.ts";
import type { Journal } from "../journal/types.ts";
import type { Kernel } from "../kernel/protocol.ts";
import type { TickCounts } from "./dispatcher.ts";
import type { DrainOptions, DrainResult } from "./drain.ts";
import type { InProcessTracker } from "./transport/in-process.ts";
import type { Worker } from "./worker/registry.ts";

/**
 * The parts of a Zod schema the host actually uses. Structural, so `Activity` and
 * `SignalDef` satisfy it without the host importing zod — and without fighting the
 * invariance of `z.ZodType` when the registry erases the schema's type.
 */
export interface Validator {
  /** Zod's `safeParse` shape: never throws, reports issues on failure. */
  safeParse(
    value: unknown,
  ):
    | { success: true; data: unknown }
    | {
        success: false;
        error: { message: string; issues: readonly { path: PropertyKey[]; message: string }[] };
      };
}

/**
 * An activity as the host knows it: a name and a validator for the worker's output.
 * `hash` and `jsonSchema` are present on real `Activity` values and drive registry
 * upserts on boot; a bare `{ name, output }` still validates.
 */
export interface ActivityRegistration {
  /** Activity name, as the workflow schedules it. */
  readonly name: string;
  /** Validates a worker's output before it is folded; a failure fails the attempt with `schema_violation`. */
  readonly output: Validator;
  /** Content hash of the activity definition; the registry version. */
  readonly hash?: string;
  /** JSON Schema for both sides, written to the registry on boot when `hash` is also present. */
  readonly jsonSchema?: { input: unknown; output: unknown };
  /** Retry policy, journaled next to the schema as byte-exact JSON. */
  readonly retry?: unknown;
}

/** A signal as the host knows it: a name and a validator for incoming payloads. */
export interface SignalRegistration {
  /** Signal name, as the workflow waits for it. */
  readonly name: string;
  /** Validates a payload before delivery; a failure is a `BadRequest`. */
  readonly schema: Validator;
  /** Content hash of the signal definition; the registry version. */
  readonly hash?: string;
  /** JSON Schema of the payload, written to the registry on boot when `hash` is also present. */
  readonly jsonSchema?: unknown;
}

/** How tasks on one queue leave this host. */
export interface QueueConfig {
  /** Where to push tasks on this queue. Absent ⇒ in-process only. */
  url?: string;
  /** HMAC secret shared with the queue's worker. Required for HTTP push. */
  secret?: string;
  /** `push` (default) dispatches from the outbox; `pull` leaves tasks for `POST /v1/tasks/poll`. */
  mode?: "push" | "pull";
}

/** Every credential a host reads. All optional; an empty config is an open host. */
export interface AuthConfig {
  /** Bearer token required on the control-plane routes. Absent ⇒ open host. */
  token?: string;
  /** HMAC secret this host's worker role verifies inbound pushes with. */
  pushSecret?: string;
  /** Bearer token this host's worker role sends when it calls a task back. */
  callbackToken?: string;
  /**
   * HMAC secret for signed action links. Falls back to `token`, then `pushSecret`; with
   * none of the three configured, minting and verifying links is refused.
   */
  linkSecret?: string;
}

/**
 * One of the engine's roles: `orchestrator` moves the outbox, `api` serves the control
 * plane, `worker:<queue>` runs that queue's activities in-process and accepts pushes for it.
 */
export type Role = "orchestrator" | "api" | `worker:${string}`;

/** The shared state every host function takes as its first argument. Built by `createHost`. */
export interface HostContext {
  /** Durable state and task queue. */
  journal: Journal;
  /** Where payloads over the inline limit are offloaded. */
  blob: BlobStore;
  /** The wasm kernel. A proxy that throws until `start()` has loaded it. */
  kernel: Kernel;
  /** Clock for journaled timestamps, epoch milliseconds. */
  now: () => number;
  /** Namespace new runs are created in. */
  namespace: string;
  /** Registered workflows by name. */
  workflows: Map<string, Workflow>;
  /** Registered activities by name. */
  activities: Map<string, ActivityRegistration>;
  /** Registered signals by name. */
  signals: Map<string, SignalRegistration>;
  /** Workers this process runs in-process, by the queues they serve. */
  workers: Worker[];
  /** Per-queue delivery configuration. */
  queues: Record<string, QueueConfig>;
  /** Credentials this host checks and sends. */
  auth: AuthConfig;
  /** Roles this process holds. */
  roles: ReadonlySet<Role>;
  /** Base URL other processes can reach this host on; fills `complete_url` on a push. */
  publicUrl?: string;
  /**
   * Path prefix this host is mounted under, normalised to `/api/vlo`. The router strips it
   * before matching and every URL built from `publicUrl` carries it.
   */
  basePath?: string;
  /** How often an open SSE stream looks for new journal events. */
  streamPollMs: number;
  /**
   * In-memory side channel. `emit` carries `cmd.emit` payloads, `warning` carries the
   * dispatcher's, and `task_scheduled` wakes a long-poll the moment a task is written.
   */
  events: EventEmitter;
  /** Set when this process holds the `orchestrator` role. */
  kick: () => void;
  /** One dispatcher pass. Present only when this process holds the `orchestrator` role. */
  tick?: () => Promise<TickCounts>;
  /** Ticks until idle. Present only when this process holds the `orchestrator` role. */
  drain?: (options?: DrainOptions) => Promise<DrainResult>;
  /** In-process handlers still owing a result; `drain` waits on it between passes. */
  inProcess: InProcessTracker;
}

/** The `task_scheduled` payload: enough for a poller to tell whether it cares. */
export interface TaskScheduled {
  /** The run the task belongs to. */
  run_id: string;
  /** The scheduled task. */
  task_id: string;
  /** The queue it was scheduled on. */
  queue: string;
}
