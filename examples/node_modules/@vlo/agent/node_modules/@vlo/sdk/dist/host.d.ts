import { $ as HashAtSeq, A as withRetryInput, B as HttpPushOptions, C as ActivityImpls, D as WorkerOptions, E as Worker, F as Dispatcher, H as PushResult, I as DispatcherMode, J as Workflow, L as DispatcherOptions, M as DrainOptions, N as DrainResult, O as defineWorker, P as drainHost, Q as DeriveIdsOutput, R as TickCounts, S as ActivityHandler, T as UsageInput, U as PushedTask, V as HttpPushTransport, W as TaskTransport, _ as InProcessTracker, a as Registries, at as PrepareEventInput, b as TaskReporter, c as ActivityRegistration, ct as RefoldCheckOutput, d as QueueConfig, et as Kernel, f as Role, g as InProcessOptions, h as Validator, i as DomainDef, it as PlanRetryInput, j as DEFAULT_DRAIN_MAX_MS, k as findWorker, l as AuthConfig, lt as RetryPlan, m as TaskScheduled, n as isTerminalRunStatus, nt as KernelResult, o as defineDomain, ot as Prepared, p as SignalRegistration, r as Domain, rt as KernelVersion, s as mergeDomains, st as ReduceStepInput, t as TERMINAL_RUN_STATUSES, tt as KernelError, u as HostContext, ut as BlobStore, v as InProcessTransport, w as TaskContext, x as handleTask, y as HandleTaskOptions, z as FetchLike } from "./run-status-B5GxnHVb.js";
import { A as StepState, B as TaskUpdate, C as KernelState, E as Reduction, F as NewTask, I as NewTimer, L as RunPatch, M as Completion, N as Emit, O as RunStatus, P as NewSpawn, R as RunRef, S as Json, V as Transition, _ as Cause, a as NewRunRow, b as EventInput, c as RunRow, d as SignalWaitRow, f as StateRow, h as TimerRow, i as JournalTx, j as Usage, l as SchemaRow, m as TaskRow, n as Journal, o as NewSignalRow, p as TaskClaimFilter, r as JournalClosed, s as RunQuery, t as ApplyTransitionOptions, u as SignalRow, w as Kind, y as Envelope, z as SignalWait } from "./types-BkQ6NGIA.js";
import { EventEmitter } from "node:events";
//#region src/host/api/router.d.ts
/** A fetch-style request handler: what `Host.fetch`, `handler()` and `listen()` all speak. */
type FetchHandler = (request: Request) => Promise<Response>;
/** `"api/vlo"`, `"/api/vlo/"` and `"/api/vlo"` all normalise to `"/api/vlo"`; `""` to none. */
export declare function normalizeBasePath(value: string | undefined): string | undefined;
/**
 * Builds the `/v1` router for a context. Every {@link VloError} becomes a JSON error response
 * with its status; anything else is a 500. Routes a role is not held for answer 404
 * `role_not_served`. `createHost` calls this; only custom hosts need it directly.
 */
export declare function createRouter(ctx: HostContext): FetchHandler;
//#endregion
//#region src/host/node-server.d.ts
/** A bound `node:http` server. */
interface Listening {
  /** `http://<host>:<port>`, with the port actually bound. */
  url: string;
  /** The port actually bound; differs from the request when `0` was asked for. */
  port: number;
  /** Closes every open connection (SSE streams included) and stops listening. */
  close(): Promise<void>;
}
/**
 * Serves a fetch-style handler on `port` (`0` picks a free one) and `host` (default
 * `127.0.0.1`). Rejects when the port cannot be bound. Response bodies are streamed, so an
 * SSE response works without a framework.
 */
export declare function listen(handler: FetchHandler, port: number, host?: string): Promise<Listening>;
//#endregion
//#region src/host/roles.d.ts
/** Blob store used when {@link CreateHostOptions.blob} is absent: a `file://` directory relative to the working directory. */
export declare const DEFAULT_BLOB_URL = "file://.vlo/blobs";
/** Port {@link serve} binds when `port` is absent. */
export declare const DEFAULT_PORT = 4100;
/** How often an open SSE stream re-reads the journal when `streamPollMs` is absent, in milliseconds. */
export declare const DEFAULT_STREAM_POLL_MS = 500;
/** How long `stop()` gives in-process handlers to report before the journal closes. */
export declare const SHUTDOWN_GRACE_MS = 5000;
/** What {@link createHost} needs: durable stores, the registries, and which roles this process plays. */
interface CreateHostOptions {
  /** A `Journal`, or a URL the host opens (and closes on `stop`). */
  journal: Journal | string;
  /** A `BlobStore`, or a `file://` / `gcs://` URL to open. Default {@link DEFAULT_BLOB_URL}. */
  blob?: BlobStore | string;
  /** Workflows this host can run, by name. Starting an unregistered one is refused. Optional when `domains` supplies them. */
  workflows?: readonly Workflow[];
  /** Domains from `defineDomain`; their registries are flattened onto the four arrays below. */
  domains?: readonly Domain[];
  /**
   * Activities whose output schema the host enforces before folding a result. Unregistered
   * activities still run; their output is folded as opaque JSON.
   */
  activities?: readonly ActivityRegistration[];
  /** Workers run in this process. Each adds a `worker:<queue>` role when `roles` is absent. */
  workers?: readonly Worker[];
  /** Signals whose payload the host validates before delivery. Unregistered signals pass through as-is. */
  signals?: readonly SignalRegistration[];
  /** Roles this process holds. Default: `orchestrator`, `api`, plus one `worker:<queue>` per queue of every worker. */
  roles?: readonly Role[];
  /** Per-queue delivery: a push URL and secret, or `mode: "pull"`. Queues not listed are in-process only. */
  queues?: Record<string, QueueConfig>;
  /** Credentials for the control plane, inbound pushes, callbacks and signed links. Absent ⇒ open host. */
  auth?: AuthConfig;
  /** Namespace new runs are created in and `listRuns` filters by. Default `"default"`. */
  namespace?: string;
  /** Base URL peers reach this host on; fills `complete_url` on an outbound push. */
  publicUrl?: string;
  /**
   * Path prefix this host is mounted under, e.g. `"/api/vlo"` for a Next route file at
   * `app/api/vlo/[[...path]]/route.ts`. The router strips it before matching and every URL
   * built from `publicUrl` carries it.
   */
  basePath?: string;
  /** How often an open SSE stream looks for new journal events. Default 500 ms. */
  streamPollMs?: number;
  /** Clock for every journaled timestamp, in epoch milliseconds. Default `Date.now`. */
  now?: () => number;
  /** Injected for tests; otherwise the wasm kernel is loaded on `start`. */
  kernel?: Kernel;
  /** Outbox dispatcher tuning. Only read when this host holds the `orchestrator` role. */
  dispatcher?: DispatcherOptions;
}
/** A running (or startable) host: the fetch handler plus the controls a process owner needs. */
interface Host {
  /** The HTTP surface as a `(Request) => Response`. Starts the host on first call. */
  readonly fetch: FetchHandler;
  /** Loads the kernel, migrates the journal and starts the dispatcher. Idempotent. */
  start(): Promise<void>;
  /**
   * Stops the dispatcher, waits up to {@link SHUTDOWN_GRACE_MS} for in-process handlers, then
   * closes the journal if the host opened it from a URL. Idempotent.
   */
  stop(): Promise<void>;
  /** One dispatcher pass. Rejects on a host without the `orchestrator` role. */
  tick(): Promise<TickCounts>;
  /**
   * Ticks until the outbox is idle or `maxMs` (default 25 s) runs out. Concurrent callers
   * share one drain. Rejects on a host without the `orchestrator` role.
   */
  drain(options?: DrainOptions): Promise<DrainResult>;
  /** In-memory side channel: `emit` (from `cmd.emit`), `warning` (dispatcher) and `task_scheduled`. */
  readonly events: EventEmitter;
  /** The journal this host reads and writes. */
  readonly journal: Journal;
  /** Roles this process holds. */
  readonly roles: ReadonlySet<Role>;
  /** Base URL peers reach this host on. Settable, so {@link serve} can fill it after binding a port. */
  publicUrl: string | undefined;
}
/**
 * Builds a host without binding a port or starting it. Nothing is loaded or migrated until
 * `start()` (or the first `fetch`). A `journal` given as a URL is opened here and closed by
 * `stop()`; a `Journal` instance is left to its owner.
 *
 * @example
 * ```ts
 * import { createClient, createHost, defineWorker } from "@vlo/sdk/host";
 *
 * const host = createHost({
 *   journal: "sqlite://./.vlo/dev.db",
 *   workflows: [pipeline],
 *   activities: [render],
 *   workers: [defineWorker({ "pull.render": (input: { clip: string }) => ({ rendered: input.clip }) })],
 * });
 * await host.start();
 *
 * const client = createClient({ fetch: host.fetch });
 * const run = await client.start(pipeline, { clip: "reel" });
 * await client.waitFor(run.run_id, "completed");
 * await host.stop();
 * ```
 */
export declare function createHost(options: CreateHostOptions): Host;
/** {@link CreateHostOptions} plus where to listen. */
interface ServeOptions extends CreateHostOptions {
  /** TCP port to bind. Default {@link DEFAULT_PORT}; `0` picks a free one. */
  port?: number;
  /** Interface to bind. Default `127.0.0.1`. */
  hostname?: string;
}
/** A bound server: the listener's `url`, `port` and `close()`, plus the host behind it. */
interface ServeResult extends Listening {
  /** The host serving requests. `close()` on the result stops it too. */
  host: Host;
}
/**
 * Binds a port, tells the host its own URL, then starts it. `publicUrl` is set to the
 * listener's URL unless the options give one, so pushed tasks carry a working `complete_url`.
 *
 * @example
 * ```ts
 * import { serve } from "@vlo/sdk/host";
 *
 * const server = await serve({
 *   journal: "postgres://user:pass@localhost/app",
 *   workflows: [pipeline],
 *   activities: [render],
 *   auth: { token: "control-plane-token" },
 *   port: 4100,
 * });
 * console.log(server.url); // http://127.0.0.1:4100
 * await server.close();
 * ```
 */
export declare function serve(options: ServeOptions): Promise<ServeResult>;
/**
 * Next route file: `export const { GET, POST } = handler({ … })`. The host is created on the
 * first request and shared by every request after, so a serverless function pays for the
 * kernel load once per instance. Pair it with `dispatcher: { mode: "manual" }` and a cron on
 * `POST /v1/timers/tick`.
 *
 * @example
 * ```ts
 * // app/api/vlo/[[...path]]/route.ts
 * import { handler } from "@vlo/sdk/host";
 *
 * export const { GET, POST } = handler({
 *   journal: process.env.DATABASE_URL ?? "sqlite://./.vlo/dev.db",
 *   workflows: [pipeline],
 *   activities: [render],
 *   basePath: "/api/vlo",
 *   dispatcher: { mode: "manual" },
 * });
 * ```
 */
export declare function handler(options: CreateHostOptions): {
  GET: FetchHandler;
  POST: FetchHandler;
};
//#endregion
//#region src/host/worker/reporters.d.ts
/** Reports straight into this host's journal via {@link completeTask}, {@link failTask} and {@link heartbeatTask}. */
export declare function localReporter(ctx: HostContext): TaskReporter;
/**
 * Reports over HTTP to the host that owns the task. `completeUrl` is the task's base URL
 * (`…/v1/tasks/{id}`); the three verbs hang off it. Each call has a 10 s timeout and throws
 * a plain `Error` on a non-2xx answer, which for `heartbeat` is how a lost lease surfaces.
 */
export declare function remoteReporter(completeUrl: string, token: string | undefined, fetchImpl?: FetchLike): TaskReporter;
//#endregion
//#region src/host/worker/pull.d.ts
interface PullWorkerOptions {
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
export declare function runPullWorker(options: PullWorkerOptions): Promise<void>;
//#endregion
//#region src/host/worker/signature.d.ts
/**
 * Push signatures. Same shape as the repo's Zernio webhook verifier: HMAC-SHA256, hex,
 * compared timing-safe — but the signed string binds the task and a timestamp as well as
 * the body, so a captured push cannot be replayed onto a different attempt or an hour later.
 */
/** Header carrying the pushed task's id. */
export declare const TASK_ID_HEADER = "vlo-task-id";
/** Header carrying the attempt number. */
export declare const ATTEMPT_HEADER = "vlo-attempt";
/** Header carrying the signing time, epoch milliseconds. */
export declare const TIMESTAMP_HEADER = "vlo-timestamp";
/** Header carrying the signature, `v1=<hex>`. */
export declare const SIGNATURE_HEADER = "vlo-signature";
/**
 * Signs a push: `v1=` + HMAC-SHA256 over `taskId.attempt.tsMs.sha256(body)`, hex. The
 * dispatcher's HTTP transport calls this; a custom transport signs the same way.
 */
export declare function signPush(secret: string, taskId: string, attempt: number, tsMs: number, body: string): string;
/** Anything with `Headers.get` semantics. */
interface HeaderSource {
  /** The header's value, or null when absent. */
  get(name: string): string | null;
}
/**
 * True when the `vlo-*` headers sign `rawBody` with `secret` and the timestamp is within
 * 5 minutes of `nowMs` (default `Date.now()`). Missing or malformed headers are false, never
 * thrown; the comparison is timing-safe.
 */
export declare function verifySignature(secret: string, headers: HeaderSource, rawBody: string, nowMs?: number): boolean;
//#endregion
//#region src/host/worker/complete.d.ts
/** What a task report resolved to. */
interface TaskResult {
  /** True when the attempt had already been settled, so nothing was written. */
  duplicate: boolean;
}
/**
 * Records an attempt's output. Validated against the registered activity's output schema
 * when there is one; a violation fails the attempt with `schema_violation` and no retry.
 * The first terminal result for an attempt wins; later ones return `duplicate: true`.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 */
export declare function completeTask(ctx: HostContext, taskId: string, attempt: number, output: unknown, usage?: Usage): Promise<TaskResult>;
/**
 * Records an attempt's failure: a `retrying` event when `retryable` and the kernel's retry
 * plan allows another attempt, otherwise a `failed` event. The first terminal result for an
 * attempt wins; later ones return `duplicate: true`.
 *
 * `cause` names who lost the attempt: the handler by default, the reaper on a dead lease.
 * `usage` is banked whichever way the attempt ends — tokens burned before a throw are spent.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 */
export declare function failTask(ctx: HostContext, taskId: string, attempt: number, error: string, retryable?: boolean, cause?: Cause, usage?: Usage): Promise<TaskResult>;
/**
 * Extends the attempt's lease by the task's `lease_ttl_ms` from now.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 * @throws {@link LeaseLost} when the task is not running at that attempt any more.
 */
export declare function heartbeatTask(ctx: HostContext, taskId: string, attempt: number): Promise<void>;
//#endregion
//#region src/host/transition.d.ts
/** What one `applyEvent` call did. */
interface TxOutcome {
  /** False when the source decided there was nothing to submit. */
  applied: boolean;
  /** True for an at-least-once redelivery the kernel has already folded. */
  duplicate: boolean;
  /** The run row as it was locked, before the transition. */
  run: RunRow;
  /** The kernel's write-set. Present only when `applied` is true. */
  transition?: Transition;
  /** Buffered signals that matched a wait this transition opened; applied after commit. */
  followUps: EventInput[];
}
/**
 * The event to submit. A function form runs inside the transaction with the run already
 * locked, so it can read and write journal rows before deciding — returning `null` commits
 * whatever it did without folding anything.
 */
type EventSource = EventInput | ((tx: JournalTx, run: RunRow) => Promise<EventInput | null>);
/** Extra journal work to commit atomically with the transition. */
type AfterApply = (tx: JournalTx, outcome: TxOutcome) => Promise<void>;
/**
 * Submits one event. Owns its transaction, recovers a reducer throw or a divergence into
 * the matching marker, then runs the post-commit work (buffered signals, emits, kick).
 *
 * A `ReducerFailed` is swallowed: the run is failed with an `app_error` marker and that
 * outcome is returned. A `Nondeterminism` is recorded as a marker and then rethrown.
 *
 * @throws {@link RunNotFound} when no run has that id.
 * @throws {@link RunTerminal} when the run ended and the event is not a task result or a closing marker.
 * @throws {@link WorkflowRejected} when the run's workflow is not registered on this host.
 * @throws {@link IllegalEvent} when the kernel refuses the event for a reason other than a duplicate.
 * @throws {@link Nondeterminism} after journaling the divergence.
 */
export declare function applyEvent(ctx: HostContext, runId: string, source: EventSource, after?: AfterApply): Promise<TxOutcome>;
//#endregion
//#region src/host/refold.d.ts
/** The checkpoint a fold starts from. Both fields are absent before the `started` event. */
interface FoldState {
  /** Kernel-owned state at the checkpoint. */
  kernelState?: KernelState;
  /** User state at the checkpoint, byte-exact JSON text. */
  state?: string;
}
/** A checkpoint rebuilt from the journal by {@link rebuildCheckpoint}. */
interface Rebuilt {
  /** Kernel-owned state after the last input event. */
  kernelState: KernelState;
  /** User state after the last input event, byte-exact JSON text. */
  state: string;
  /** Hash of the pair above, equal to the last journaled `state_hash`. */
  stateHash: string;
  /** Seq of the last event folded. */
  seq: number;
  /** Run status after the last event folded. */
  status: RunStatus;
}
/**
 * One event → one write-set. The reducer runs here and nowhere else. Pure: nothing is
 * journaled, the caller applies the returned transition.
 *
 * @throws {@link ReducerFailed} when the workflow's reducer throws; carries the trigger event.
 * @throws {@link IllegalEvent} when the kernel refuses to prepare or reduce the event.
 */
export declare function foldEvent(ctx: HostContext, workflow: Workflow, run: RunRef, at: FoldState, event: EventInput): Transition;
/**
 * Replays every input event in the journal. Kernel outputs (scheduled tasks, signal waits,
 * the `complete` marker) are recomputed, never re-fed.
 *
 * @throws {@link Nondeterminism} at the first event whose replayed `seq` or `state_hash`
 * differs from the journaled one, or when `events` holds nothing foldable.
 */
export declare function rebuildCheckpoint(ctx: HostContext, workflow: Workflow, run: RunRow, events: readonly Envelope[]): Rebuilt;
//#endregion
//#region src/host/runs.d.ts
/** A run as the API returns it: the row minus internals, with the output inlined. */
interface RunView {
  /** The run's id. */
  run_id: string;
  /** Workflow name. */
  workflow: string;
  /** Current status. */
  status: RunStatus;
  /** Seq of the last journaled event. */
  last_seq: number;
  /** Caller-supplied search attributes given at start. */
  search: Record<string, Json>;
  /** When the row was created, epoch milliseconds. */
  created_at_ms: number;
  /** When the row last changed, epoch milliseconds. */
  updated_at_ms: number;
  /** When the `started` event was folded, epoch milliseconds. */
  started_at_ms?: number;
  /** When the run reached a terminal status, epoch milliseconds. */
  closed_at_ms?: number;
  /** The parent run, for a spawned child. */
  parent_run_id?: string;
  /** The run this one continued from, when it was started by a `continue_as_new`. */
  continued_from?: string;
  /** The successor this run handed its input to; set once the run is `continued`. */
  continued_to?: string;
  /** Completion output, read back from the blob store when it was offloaded. */
  output?: Json;
  /** Why the run failed: the `error` of its closing marker. Present only when `status` is `failed`. */
  error?: string;
  /** The closing marker's cause (`app_error` or `nondeterminism_detected`). Present with `error`. */
  cause?: Cause;
}
/** What {@link startRun} needs. */
interface StartRunInput {
  /** Name of a workflow registered on this host. */
  workflow: string;
  /** Start input, journaled on the `started` event. `undefined` is stored as `null`. */
  input: Json;
  /** Caller-chosen id. Default `run_<32 hex>`. Creating an existing id is a no-op. */
  runId?: string;
  /** Search attributes returned on the view and stored on the row. */
  search?: Record<string, Json>;
  /** Namespace to create the run in. Default: the host's. */
  namespace?: string;
}
/**
 * Writes a `created` run row and kicks the dispatcher; the `started` event is folded by the
 * outbox. Idempotent on `runId`. Runs on a host with the `api` role.
 *
 * @throws {@link WorkflowRejected} when the workflow is not registered.
 */
export declare function startRun(ctx: HostContext, opts: StartRunInput): Promise<{
  run_id: string;
}>;
/** What {@link signalRun} returns. */
interface SignalResult$1 {
  /** The stored signal's id, `sig_<32 hex>`. */
  signal_id: string;
  /**
   * True when an open wait folded the signal into the run. False in two cases: nothing was
   * waiting, so the signal is buffered until a wait with that name opens; or the wait it
   * matched had already closed — its timeout fired first, or the run has ended — a late
   * signal. A late signal is recorded against the closed step, never folded, never buffered,
   * and the stale wait row is dropped.
   */
  delivered: boolean;
}
/**
 * Stores a signal and, when the run is waiting on that name, delivers it in the same
 * transaction. Validated against the registered signal schema when there is one. Never
 * answers 409 for an ended run: the signal is stored and reported as not delivered.
 *
 * @throws {@link BadRequest} when the payload fails the schema.
 * @throws {@link RunNotFound} when no run has that id.
 */
export declare function signalRun(ctx: HostContext, runId: string, name: string, payload: Json): Promise<SignalResult$1>;
/**
 * Folds a `cancel` marker and returns the run. Cancelling an ended run is a no-op that
 * still returns the view.
 *
 * @throws {@link RunNotFound} when no run has that id.
 */
export declare function cancelRun(ctx: HostContext, runId: string): Promise<RunView>;
/**
 * Reads one run, inlining an offloaded output.
 *
 * @throws {@link RunNotFound} when no run has that id.
 */
export declare function getRunView(ctx: HostContext, runId: string): Promise<RunView>;
/** Lists runs in the host's namespace unless `query.namespace` says otherwise. */
export declare function listRuns(ctx: HostContext, query: RunQuery): Promise<RunView[]>;
/** Journaled events with `seq > sinceSeq`, ascending. Empty for an unknown run. */
export declare function readRunEvents(ctx: HostContext, runId: string, sinceSeq: number): Promise<Envelope[]>;
//#endregion
//#region src/host/links.d.ts
/** How long a minted link stays valid when the request gives no `expires_in_ms`: 7 days. */
export declare const DEFAULT_LINK_TTL_MS: number;
/** What a link token binds: one run, one signal, one deadline. */
interface SignalLinkClaims {
  /** The run the signal is delivered to. */
  runId: string;
  /** The signal's name. */
  name: string;
  /** Epoch milliseconds after which the token is refused. Floored to an integer when signed. */
  expiresAtMs: number;
}
/**
 * The secret signed links are minted with. Falls back to the control-plane token and then
 * the push secret so a single-secret deployment gets links for free; `undefined` disables
 * them rather than signing with an empty key.
 */
export declare function linkSecret(auth: AuthConfig): string | undefined;
/**
 * Mints the token for a link: `v1.<expiresAtMs>.<hmac-sha256 hex>`. The host's
 * `POST /v1/runs/{id}/links/{name}` route does this for you; call it directly to mint
 * links out of band with the same secret ({@link linkSecret}).
 *
 * @example
 * ```ts
 * const token = signSignalLink(secret, {
 *   runId: "run_1",
 *   name: "approve",
 *   expiresAtMs: Date.now() + DEFAULT_LINK_TTL_MS,
 * });
 * verifySignalLink(secret, token, "run_1", "approve", Date.now()); // true
 * ```
 */
export declare function signSignalLink(secret: string, link: SignalLinkClaims): string;
/**
 * True when `token` was signed with `secret` for exactly this `(runId, name)` and has not
 * expired at `nowMs`. Malformed tokens are false, never thrown; the comparison is timing-safe.
 */
export declare function verifySignalLink(secret: string, token: string, runId: string, name: string, nowMs: number): boolean;
//#endregion
//#region src/host/errors.d.ts
/**
 * Base of every error the host maps to an HTTP response. The router turns one into
 * `{ error: { code, message } }` with `status`; anything else is a 500 `internal`.
 */
export declare class VloError extends Error {
  /** HTTP status the router answers with. */
  readonly status: number;
  /** Stable machine-readable code, e.g. `run_not_found`. */
  readonly code: string;
  /** `name` is set to the concrete subclass name. */
  constructor(code: string, message: string, status: number);
}
/** No run with that id. `run_not_found`, 404. */
export declare class RunNotFound extends VloError {
  readonly runId: string;
  /** @param runId The id that was looked up; kept on the error. */
  constructor(runId: string);
}
/** No task with that id. `task_not_found`, 404. */
export declare class TaskNotFound extends VloError {
  readonly taskId: string;
  /** @param taskId The id that was looked up; kept on the error. */
  constructor(taskId: string);
}
/**
 * The run already ended, so a non-task event (a signal, say) cannot be applied.
 * `run_terminal`, 409. A late task result on an ended run is a duplicate, not this.
 */
export declare class RunTerminal extends VloError {
  /** `status` is the terminal status the run is in. */
  constructor(runId: string, status: string);
}
/** The kernel refused the event: a duplicate, a stale attempt or an illegal transition. */
export declare class IllegalEvent extends VloError {
  /** The kernel's refusal, verbatim. Its `code` becomes this error's `code`. */
  readonly kernelError: KernelError;
  /** Code is the kernel's (`unknown_step`, `bad_seq`, `illegal_transition`, …), status 409. */
  constructor(error: KernelError);
}
/**
 * The checkpoint or the re-fold disagreed with the journal. The run is failed first: the
 * `nondeterminism` marker it records carries `cause: "nondeterminism_detected"`, which is the
 * kernel's `Cause` value and stays as it is. This error's own code is `refold_mismatch`.
 */
export declare class Nondeterminism extends VloError {
  /** The run that diverged. */
  readonly runId: string;
  /** The first journal seq the replay disagreed at; 0 when the journal holds nothing foldable. */
  readonly seq: number;
  /** `refold_mismatch`, 409. */
  constructor(
  /** The run that diverged. */
  runId: string,
  /** The first journal seq the replay disagreed at; 0 when the journal holds nothing foldable. */
  seq: number, detail: string);
}
/**
 * The reducer threw, or the host could not honour what it asked for. `applyEvent` swallows
 * this and records a `fail` marker with `cause: "app_error"` (the kernel's `Cause` value; this
 * error's own code is `reducer_failed`). Also raised when a `spawn` or `continue_as_new`
 * names a workflow this host has not registered.
 */
export declare class ReducerFailed extends VloError {
  /** The run whose reducer threw. */
  readonly runId: string;
  /** The event being folded when the reducer threw; journaled on the `fail` marker. */
  readonly trigger?: EventInput | undefined;
  /** The reducer's own message, without the folding context; journaled as the `fail` marker's `error`. */
  readonly reason: string;
  /** `reducer_failed`, 409. Callers of `applyEvent` never see it; the run is failed instead. */
  constructor(
  /** The run whose reducer threw. */
  runId: string, message: string,
  /** The event being folded when the reducer threw; journaled on the `fail` marker. */
  trigger?: EventInput | undefined,
  /** Default: `message`. */
  reason?: string);
}
/** The host was asked to run a workflow it does not have registered. */
export declare class WorkflowRejected extends VloError {
  /** `unknown_workflow`, 400. */
  constructor(name: string);
}
/** Bearer token or push signature missing or wrong. `unauthorized`, 401. */
export declare class Unauthorized extends VloError {
  /** Message defaults to `missing or invalid credentials`. */
  constructor(message?: string);
}
/** Malformed body, query or signal payload. `bad_request`, 400. */
export declare class BadRequest extends VloError {
  /** `bad_request`, 400. */
  constructor(message: string);
}
/** The worker's lease is gone: stop working, someone else owns the attempt. */
export declare class LeaseLost extends VloError {
  /** `lease_lost`, 410. */
  constructor(taskId: string, attempt: number);
}
//#endregion
//#region src/kernel/load.d.ts
/**
 * Loads the wasm kernel once per process and returns the same instance afterwards. Looks for
 * `vlo_kernel_bg.wasm` in the package's `wasm/` directory, or at `VLO_KERNEL_WASM`. Rejects
 * when the bytes are missing or the kernel speaks a different protocol version.
 */
export declare function loadKernel(): Promise<Kernel>;
//#endregion
//#region src/journal/postgres.d.ts
interface PostgresJournalOptions {
  /** Schema that owns every journal table. Default `vlo`. */
  schema?: string;
  /** Maximum pooled connections. */
  max?: number;
}
//#endregion
//#region src/journal/open.d.ts
/** Options for {@link openJournal}. Only the Postgres journal reads any. */
type JournalOptions = PostgresJournalOptions;
/**
 * Opens a journal by URL: `sqlite://:memory:`, `sqlite://./.vlo/dev.db`,
 * `sqlite:///abs/path.db`, `postgres://…` or `postgresql://…`. Nothing is created or
 * migrated until `migrate()`. Throws a plain `Error` on any other scheme.
 *
 * @example
 * ```ts
 * import { openJournal } from "@vlo/sdk/host";
 *
 * const journal = openJournal("postgres://user:pass@localhost/app", { schema: "vlo", max: 5 });
 * await journal.migrate();
 * const run = await journal.getRun("run_1");
 * await journal.close();
 * ```
 */
export declare function openJournal(url: string, opts?: JournalOptions): Journal;
//#endregion
//#region src/blob/open.d.ts
/**
 * Opens a blob store by URL: `file://<dir>` (relative to the working directory when the
 * path is) or `gcs://<bucket>/<prefix>`. The GCS client is only loaded on first use.
 * Throws a plain `Error` on any other scheme or an empty directory or bucket.
 */
export declare function openBlobStore(url: string): BlobStore;
//#endregion
//#region src/blob/gcs.d.ts
/** The slice of `@google-cloud/storage` used here, so a fake client needs nothing more. */
interface GcsFileLike {
  /** `[true]` when the object exists. */
  exists(): Promise<[boolean]>;
  /** Uploads the bytes. The store passes `resumable: false` and an octet-stream content type. */
  save(data: Uint8Array, options?: {
    resumable?: boolean;
    contentType?: string;
  }): Promise<unknown>;
  /** Downloads the object's bytes. */
  download(): Promise<[Uint8Array]>;
}
/** The slice of a GCS bucket handle used here. */
interface GcsBucketLike {
  /** A handle for the object at `name`. */
  file(name: string): GcsFileLike;
}
/** The slice of a GCS client used here. */
interface GcsClientLike {
  /** A handle for the bucket. */
  bucket(name: string): GcsBucketLike;
}
/** Where a {@link GcsBlobStore} writes. */
interface GcsBlobStoreOptions {
  /** Bucket name. Required. */
  bucket: string;
  /** Key prefix inside the bucket, e.g. `vlo/blobs`. */
  prefix?: string;
  /** GCP project for the default client. Absent ⇒ the credentials' project. */
  projectId?: string;
  /** Injected client. Absent ⇒ `@google-cloud/storage` with ADC. */
  client?: GcsClientLike;
}
/**
 * The Google Cloud Storage {@link BlobStore}. Opened by `openBlobStore("gcs://…")`. Needs
 * the optional peer dependency `@google-cloud/storage` unless a `client` is injected.
 */
export declare class GcsBlobStore implements BlobStore {
  private readonly bucketName;
  private readonly prefix;
  private readonly projectId;
  private bucket;
  /** Throws a plain `Error` when `bucket` is empty. No network call is made here. */
  constructor(options: GcsBlobStoreOptions);
  /** Uploads unless an object with that digest already exists; returns the sha256 hex digest. */
  put(bytes: Uint8Array): Promise<string>;
  /** Downloads the blob; rejects with the client's error when it is missing. */
  get(sha256Hex: string): Promise<Uint8Array>;
  private keyFor;
  private open;
}
//#endregion
//#region src/client/index.d.ts
/** Anything shaped like `fetch`. `host.fetch` is the in-process case. */
type ClientFetch = (request: Request) => Promise<Response>;
/** How to reach a host. */
interface ClientOptions {
  /** Absent when `fetch` is a host handler: requests still need a syntactically valid URL. */
  baseUrl?: string;
  /** Bearer token for the control plane, when the host has one. */
  token?: string;
  /** Transport. Default `globalThis.fetch`; pass `host.fetch` to skip the socket. */
  fetch?: ClientFetch;
}
/** Options for `Client.start`. */
interface StartOptions {
  /** Caller-chosen run id. Default: host-generated. */
  runId?: string;
  /** Search attributes stored on the run. */
  search?: Record<string, Json>;
}
/** Options for `Client.startFresh`. */
interface StartFreshOptions {
  /** The key every run of this unit of work shares; the first run's id. */
  runId: string;
  /** Search attributes stored on the run when one is started. */
  search?: Record<string, Json>;
  /** How many ended runs to walk past before giving up. Default 50. */
  maxChain?: number;
}
/** What `Client.startFresh` returns. */
interface StartFreshResult {
  /** The run started or joined. */
  run: RunView;
  /** True when a live run under the key was joined instead of a new one started. */
  joined: boolean;
}
/** What `Client.signal` returns. */
interface SignalResult {
  /** The stored signal's id. */
  signal_id: string;
  /** False when nothing was waiting: the signal is buffered until a wait opens. */
  delivered: boolean;
}
/** Filters for `Client.list`. */
interface ListQuery {
  /** Status to match. */
  status?: RunStatus;
  /** Workflow name to match. */
  workflow?: string;
  /** Maximum runs. Host default 50. */
  limit?: number;
}
/** Options for `Client.signalLink`. */
interface SignalLinkOptions {
  /** How long the link stays valid. Default 7 days. */
  expiresInMs?: number;
}
/** A minted signal link, as the host returns it. */
interface SignalLink {
  /** Absolute URL carrying the `?token=`. */
  url: string;
  /** When the token stops working, epoch milliseconds. */
  expires_at_ms: number;
}
/** Options for `Client.stream`. */
interface StreamOptions {
  /** Replay journal events after this seq. Default 0: from the beginning. */
  since?: number;
  /** Closes the stream when aborted. */
  signal?: AbortSignal;
}
/** One SSE frame, already decoded. `end` is the last one a stream sends. */
type StreamMessage = {
  type: "journal";
  seq: number;
  data: Envelope;
} | {
  type: "emit";
  data: {
    channel: string;
    data: Json;
  };
} | {
  type: "end";
  data: RunView;
};
/**
 * The control-plane client. Every method maps to one `/v1` route and throws a plain `Error`
 * carrying the status and body on a non-2xx answer. Names may be passed as the definition
 * objects themselves (`activity(...)`, `signal(...)`, `defineWorkflow(...)`).
 */
interface Client {
  /** Starts a run and returns its view once the row exists (status `created` or later). */
  start(workflow: string | {
    name: string;
  }, input: Json, options?: StartOptions): Promise<RunView>;
  /** Sends a signal; buffered when the run is not waiting for it yet. */
  signal(runId: string, name: string | {
    name: string;
  }, payload: Json): Promise<SignalResult>;
  /**
   * Mints a URL that delivers this one signal to this one run without a bearer token —
   * the thing you put in an email. The host signs it; opening it renders a confirmation
   * form, and submitting that form is what signals the run.
   */
  signalLink(runId: string, name: string | {
    name: string;
  }, options?: SignalLinkOptions): Promise<SignalLink>;
  /**
   * Starts a run under `runId`, or under `${runId}_2`, `_3`, … once earlier runs with the
   * key have ended: the first id with no run is started, a live one is joined. The walk is
   * deterministic, so two concurrent callers land on the same id and the insert's
   * `ON CONFLICT DO NOTHING` makes one of them the joiner.
   */
  startFresh(workflow: string | {
    name: string;
  }, input: Json, options: StartFreshOptions): Promise<StartFreshResult>;
  /** The run's current view. */
  get(runId: string): Promise<RunView>;
  /** The run's current view, or `null` when the host has no such run. */
  find(runId: string): Promise<RunView | null>;
  /** Journaled events with `seq > since` (default 0). */
  events(runId: string, since?: number): Promise<Envelope[]>;
  /** Live events over SSE: journal envelopes, `cmd.emit` payloads, then one `end`. */
  stream(runId: string, options?: StreamOptions): AsyncIterable<StreamMessage>;
  /** Cancels the run and returns its view. */
  cancel(runId: string): Promise<RunView>;
  /** Runs in the host's namespace matching the query. */
  list(query?: ListQuery): Promise<RunView[]>;
  /** Polls every 50 ms until the run reaches one of `status`. Throws after `timeoutMs` (default 10 s). */
  waitFor(runId: string, status: RunStatus | readonly RunStatus[], timeoutMs?: number): Promise<RunView>;
}
/**
 * Builds a {@link Client}. With no options it talks to `http://vlo.localhost` over
 * `globalThis.fetch`, which is only useful together with `fetch: host.fetch`.
 *
 * @example
 * ```ts
 * import { createClient } from "@vlo/sdk/host";
 *
 * const client = createClient({ baseUrl: "http://127.0.0.1:4100", token: "control-plane-token" });
 * const run = await client.start(pipeline, { clip: "reel" });
 * await client.signal(run.run_id, "approve", { by: "me" });
 * const done = await client.waitFor(run.run_id, "completed");
 * console.log(done.output);
 * ```
 */
export declare function createClient(options?: ClientOptions): Client;
//#endregion
export { type ActivityHandler, type ActivityImpls, type ActivityRegistration, type AfterApply, type ApplyTransitionOptions, type AuthConfig, type BlobStore, type Client, type ClientFetch, type ClientOptions, type Completion, type CreateHostOptions, DEFAULT_DRAIN_MAX_MS, type DeriveIdsOutput, Dispatcher, type DispatcherMode, type DispatcherOptions, type Domain, type DomainDef, type DrainOptions, type DrainResult, type Emit, type Envelope, type EventInput, type EventSource, type FetchHandler, type FetchLike, type FoldState, type GcsBlobStoreOptions, type GcsBucketLike, type GcsClientLike, type GcsFileLike, type HandleTaskOptions, type HashAtSeq, type HeaderSource, type Host, type HostContext, type HttpPushOptions, HttpPushTransport, type InProcessOptions, InProcessTracker, InProcessTransport, type Journal, JournalClosed, type JournalOptions, type JournalTx, type Kernel, type KernelError, type Reduction as KernelReduction, type KernelResult, type KernelState, type KernelVersion, type Kind, type ListQuery, type Listening, type NewRunRow, type NewSignalRow, type NewSpawn, type NewTask, type NewTimer, type PlanRetryInput, type PostgresJournalOptions, type PrepareEventInput, type Prepared, type PullWorkerOptions, type PushResult, type PushedTask, type QueueConfig, type Rebuilt, type ReduceStepInput, type RefoldCheckOutput, type Registries, type RetryPlan, type Role, type RunPatch, type RunQuery, type RunRef, type RunRow, type RunView, type SchemaRow, type ServeOptions, type ServeResult, type SignalLink, type SignalLinkClaims, type SignalLinkOptions, type SignalRegistration, type SignalResult, type SignalRow, type SignalResult$1 as SignalRunResult, type SignalWait, type SignalWaitRow, type StartFreshOptions, type StartFreshResult, type StartOptions, type StartRunInput, type StateRow, type StepState, type StreamMessage, type StreamOptions, TERMINAL_RUN_STATUSES, type TaskClaimFilter, type TaskContext, type TaskReporter, type TaskResult, type TaskRow, type TaskScheduled, type TaskTransport, type TaskUpdate, type TickCounts, type TimerRow, type Transition, type TxOutcome, type UsageInput, type Validator, type Worker, type WorkerOptions, defineDomain, defineWorker, drainHost, findWorker, handleTask, isTerminalRunStatus, mergeDomains, withRetryInput };