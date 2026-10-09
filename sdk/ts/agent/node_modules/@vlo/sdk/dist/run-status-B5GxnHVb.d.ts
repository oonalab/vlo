import { C as KernelState, D as RetryPolicy, E as Reduction$1, O as RunStatus, R as RunRef, S as Json, T as ReducerEvent, V as Transition, _ as Cause, b as EventInput, j as Usage, n as Journal, v as Command } from "./types-BkQ6NGIA.js";
import { EventEmitter } from "node:events";
//#region src/blob/types.d.ts
/**
 * Content-addressed storage for anything too big to inline in the journal
 * (payloads and checkpoints over 256 KB).
 */
interface BlobStore {
  /** Stores the bytes and returns their sha256, lowercase hex. Idempotent. */
  put(bytes: Uint8Array): Promise<string>;
  /** The bytes stored under that digest. Rejects when there are none. */
  get(sha256Hex: string): Promise<Uint8Array>;
}
//#endregion
//#region src/kernel/kernel-api.d.ts
/** Kernel build information; the host refuses a protocol number it does not speak. */
interface KernelVersion {
  /** Kernel crate version. */
  version: string;
  /** Protocol number. */
  protocol: number;
  /** Feature flags the build supports. */
  features: string[];
}
/** An error returned by the kernel; errors are values, never exceptions. */
interface KernelError {
  /** One of the kernel's closed set of error codes. */
  code: string;
  /** Human-readable detail. */
  message: string;
  /** Sequence number the error concerns, when there is one. */
  seq?: number;
  /** Step id the error concerns, when there is one. */
  step_id?: string;
}
/** Every kernel call returns either a value or a {@link KernelError}. */
type KernelResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: KernelError;
};
/** Input of `prepareEvent`. */
interface PrepareEventInput {
  /** The run row. */
  run: RunRef;
  /** Kernel state at the current checkpoint; absent before `started`. */
  kernel_state?: KernelState;
  /**
   * The current user-state checkpoint, byte-exact. Lifecycle transitions echo and hash
   * it without calling the reducer, so pass it for any event that is not `started`.
   */
  state?: string;
  /** The event to apply. */
  event: EventInput;
}
/** Output of `prepareEvent`: either call the reducer, or apply a lifecycle transition as is. */
type Prepared = {
  /** The reducer must run. */
  mode: "reduce";
  /** The event in reducer form. */
  reducer_event: ReducerEvent;
  /** The workflow input, on `started`. */
  init_input?: Json;
  /** Kernel state to reduce against. */
  kernel_state: KernelState;
} | {
  /** No reducer call: the transition is complete. */
  mode: "lifecycle";
  /** The write-set to apply. */
  transition: Transition;
};
/** Input of `reduceStep`: the reducer's output, to be validated and turned into a write-set. */
interface ReduceStepInput {
  /** The run row. */
  run: RunRef;
  /** Kernel state the reducer ran against. */
  kernel_state: KernelState;
  /** The event that was reduced. */
  event: EventInput;
  /** What the reducer returned. */
  reduction: Reduction$1;
}
/** Input of `planRetry`. */
interface PlanRetryInput {
  /** The activity's retry policy. */
  policy: RetryPolicy;
  /** The attempt that just failed. */
  attempt: number;
  /** Why it failed. */
  cause: Cause;
  /** Journaled randomness for jitter, as a hex string, so a re-fold plans the same delay. */
  random: string;
}
/** Output of `planRetry`. */
type RetryPlan = {
  /** Retry after `delay_ms`. */
  retry: true;
  /** The next attempt number. */
  next_attempt: number;
  /** Delay before it, in milliseconds. */
  delay_ms: number;
} | {
  /** Give up. */
  retry: false;
  /** Never set. */
  next_attempt?: undefined;
  /** Never set. */
  delay_ms?: undefined;
};
/** A state hash at a sequence number, as `refoldCheck` compares them. */
interface HashAtSeq {
  /** Event sequence number. */
  seq: number;
  /** State hash after that event. */
  hash: string;
}
/** Output of `refoldCheck`. */
type RefoldCheckOutput = {
  /** Every hash matched. */
  matches: true;
  /** Never set. */
  seq?: undefined;
  /** Never set. */
  expected?: undefined;
  /** Never set. */
  actual?: undefined;
} | {
  /** A hash diverged. */
  matches: false;
  /** First divergent sequence number. */
  seq: number;
  /** The journaled hash. */
  expected: string;
  /** The re-folded hash. */
  actual: string;
};
/** Output of `deriveIds`. */
interface DeriveIdsOutput {
  /** Task id for the step attempt. */
  task_id: string;
  /** Idempotency key for the step attempt. */
  idempotency_key: string;
  /** Child run id for the step. */
  child_run_id: string;
}
/**
 * The kernel as the host sees it. Implemented by the wasm loader (`load.ts`) and by a
 * test double. Every method is synchronous and pure.
 */
interface Kernel {
  /** Kernel build, protocol number and feature flags; the host refuses a protocol mismatch. */
  version(): KernelVersion;
  /** Field and enum checks on an envelope, returning the normalised form. */
  validateEvent(event: EventInput): KernelResult<{
    normalized: EventInput;
  }>;
  /** Classifies an event: call the reducer, or apply a lifecycle transition without it. */
  prepareEvent(input: PrepareEventInput): KernelResult<Prepared>;
  /** Validates a reduction's commands and builds the write-set the journal applies. */
  reduceStep(input: ReduceStepInput): KernelResult<Transition>;
  /** Hash of kernel state plus user state, as stored on every checkpoint and event. */
  stateHash(input: {
    kernel_state: KernelState;
    state: string;
  }): KernelResult<{
    hash: string;
  }>;
  /** Whether and when to retry an attempt, from the policy, cause and journaled randomness. */
  planRetry(input: PlanRetryInput): KernelResult<RetryPlan>;
  /** Compares a re-fold's hashes with the journal's and names the first divergent seq. */
  refoldCheck(input: {
    expected: HashAtSeq[];
    actual: HashAtSeq[];
  }): KernelResult<RefoldCheckOutput>;
  /** Deterministic task id, idempotency key and child run id for a step attempt. */
  deriveIds(input: {
    run_id: string;
    step_id: string;
    attempt: number;
  }): KernelResult<DeriveIdsOutput>;
}
//#endregion
//#region src/core/workflow.d.ts
/** Workflow-state reduction: the next state plus the commands it asks the engine to run. */
type Reduction<S> = readonly [S, readonly Command[]];
type EventOf<T extends ReducerEvent["type"]> = Extract<ReducerEvent, {
  type: T;
}>;
/**
 * One pure handler per {@link ReducerEvent} type. Each receives the current state and the
 * event and returns a {@link Reduction}. A run receiving an event with no handler fails.
 */
interface Handlers<S> {
  /** The first event of a run: `state` is what `init` built from the start input. */
  started(state: S, event: EventOf<"started">): Reduction<S>;
  /** A task reached a terminal status; `event.output` is set when it `succeeded`. */
  task_done(state: S, event: EventOf<"task_done">): Reduction<S>;
  /** A signal the run was waiting on was delivered. */
  signal?(state: S, event: EventOf<"signal">): Reduction<S>;
  /** A timer opened by `cmd.timer` fired. */
  timer?(state: S, event: EventOf<"timer">): Reduction<S>;
  /** A child run started by `cmd.spawn` closed. */
  child_done?(state: S, event: EventOf<"child_done">): Reduction<S>;
}
/** What {@link defineWorkflow} takes: how to build the initial state and the handlers. */
interface WorkflowDef<S, I> {
  /** Builds the initial state from the start input. Called once, just before `on.started`. */
  init(input: I): S;
  /** The event handlers. */
  on: Handlers<S>;
}
/** The wire form of one reduction: state as byte-exact JSON, plus plain `Command` objects. */
interface ReductionWire {
  /** The next state, as `JSON.stringify` produced it. */
  state: string;
  /** The commands the handler returned, copied. */
  commands: Command[];
}
/**
 * A defined workflow: the value {@link defineWorkflow} returns and the host registers.
 * `S` is the state type, `I` the start-input type.
 */
interface Workflow<S = unknown, I = unknown> {
  /** Discriminator the config loader uses to find workflows among a module's exports. */
  readonly kind: "workflow";
  /** The name given to {@link defineWorkflow}; what a run is started by. */
  readonly name: string;
  /** Content hash of `name`; runs pin it as their component digest. */
  readonly digest: string;
  /** The definition, as given. */
  readonly def: WorkflowDef<S, I>;
  /**
   * Drive one event. Pass `initInput` for the `started` event (state is built by `init`);
   * otherwise `stateJson` is the checkpoint to fold onto. Throws when no handler is
   * registered for the event type.
   */
  reduce(stateJson: string | null, event: ReducerEvent, initInput?: Json): ReductionWire;
}
/**
 * Fails the run. There is no `cmd.fail`: a run fails when its reducer throws, which keeps
 * failure out of the command vocabulary and off the happy path.
 *
 * Host contract: the host catches a throw from `Workflow.reduce`, appends a `failed` event
 * (`cause: "app_error"`, `error` = this message) and marks the run `failed`. The state
 * checkpoint from before the event is kept, so the run can be rewound and forked.
 */
declare class WorkflowFailure extends Error {
  /** Structured context for the failure, as given; `undefined` when none was. */
  readonly details: Json | undefined;
  /** @param details - Anything JSON that helps explain the failure, e.g. the step id and cause. */
  constructor(message: string, details?: Json);
}
/**
 * Defines a workflow: a named, pure reducer over the run's events.
 *
 * `def` is either a hand-written {@link WorkflowDef} or the output of {@link sequence}.
 * Handlers must not read a clock, generate randomness or do I/O; time and randomness arrive
 * on the event. State must be JSON-serialisable: it is stringified after every reduction.
 * A handler that throws fails the run (see {@link WorkflowFailure}); so does an event
 * whose handler is not registered, or a handler returning anything but `[state, Command[]]`.
 *
 * @example
 * ```ts
 * import { cmd, defineWorkflow } from "@vlo/sdk";
 * import { work } from "./activities.ts";
 *
 * export default defineWorkflow("uppercase", {
 *   init: (input: { item: string }) => ({ item: input.item }),
 *   on: {
 *     started: (s) => [s, [cmd.task(work, { item: s.item })]],
 *     task_done: (s, e) => [s, [cmd.complete(e.output ?? null)]],
 *   },
 * });
 * ```
 */
declare function defineWorkflow<S, I>(name: string, def: WorkflowDef<S, I>): Workflow<S, I>;
//#endregion
//#region src/host/transport/types.d.ts
/** The task as a worker receives it — the HTTP push body, byte for byte. */
interface PushedTask {
  /** The task's id; the callback URL is built from it. */
  task_id: string;
  /** The run the task belongs to. */
  run_id: string;
  /** The workflow step that scheduled it. */
  step_id: string;
  /** Attempt number, starting at 1. Every report must carry it back. */
  attempt: number;
  /** Activity name and, when registered, the schema version the output is checked against. */
  activity: {
    name: string;
    schema_ref?: string;
  };
  /** Stable per attempt: a worker that sees it twice is being re-pushed, not asked to run again. */
  idempotency_key: string;
  /** The activity input. */
  input: Json;
  /** Lease length in milliseconds; each heartbeat extends it by this much. */
  lease_ms: number;
  /** How often to heartbeat, in milliseconds: a third of the lease, at least 1 s. */
  heartbeat_ms: number;
  /** Wall-clock budget for this attempt. The worker aborts the handler at it. */
  timeout_ms?: number;
  /** Base URL for `${complete_url}/complete|fail|heartbeat`. Absent for in-process work. */
  complete_url?: string;
}
/**
 * What a transport's `push` answers. `accepted` means the task is now the worker's: the
 * dispatcher records it as running. `inlineOutput` is a result the worker returned at once.
 */
type PushResult = {
  accepted: true;
  inlineOutput?: Json;
} |
/** `fatal` means the worker rejected the task itself; retrying would not help. */
{
  accepted: false;
  reason: string;
  fatal?: boolean;
};
/** Delivers a scheduled task to whatever runs it. The dispatcher picks one per queue. */
interface TaskTransport {
  /** A label for warnings, e.g. `http-push` or `in-process`. */
  readonly kind: string;
  /** Hands the task over. Must not throw for a refused push; report it in the result. */
  push(task: PushedTask): Promise<PushResult>;
}
//#endregion
//#region src/host/transport/http-push.d.ts
/** The subset of `fetch` the push needs; injected by tests. */
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
/** Where and how to push one queue's tasks. */
interface HttpPushOptions {
  /** The worker's push endpoint, typically `<worker base>/v1/tasks/push`. */
  url: string;
  /** HMAC secret shared with the worker. Required: an empty secret is refused. */
  secret: string;
  /** Clock for the signed timestamp, epoch milliseconds. Default `Date.now`. */
  now?: () => number;
  /** `fetch` implementation. Default `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Per-push request timeout in milliseconds. Default 5 s. */
  timeoutMs?: number;
}
/** Pushes tasks to a remote worker over signed HTTP. Built by the dispatcher per configured queue. */
declare class HttpPushTransport implements TaskTransport {
  /** Always `http-push`. */
  readonly kind = "http-push";
  private readonly url;
  private readonly secret;
  private readonly now;
  private readonly fetchImpl;
  private readonly timeoutMs;
  /** Throws a plain `Error` when `secret` is empty: tasks are never pushed unsigned. */
  constructor(options: HttpPushOptions);
  /**
   * POSTs the task with the four `vlo-*` headers. Never throws: a network error, a timeout
   * or a 5xx is `accepted: false` without `fatal`; a non-retryable 4xx sets `fatal`.
   */
  push(task: PushedTask): Promise<PushResult>;
}
//#endregion
//#region src/host/dispatcher.d.ts
/**
 * `loop` ticks on an interval and on every `kick()`. `manual` never does either: the
 * process it runs in has no long-lived timer to hang a tick on, so something outside —
 * a cron hitting `POST /v1/timers/tick` — decides when the outbox moves.
 *
 * `kick()` stays a no-op in `manual` mode on purpose. A kick is unattended and unbounded:
 * inside a serverless request it would start work the platform is free to freeze the moment
 * the response is sent, leaving tasks marked `running` with nobody behind them. `Host.drain`
 * (or `POST /v1/timers/tick?drain=1`) is the explicit, awaited, time-boxed form of the same
 * thing — the caller stays alive for it and knows when it stopped.
 */
type DispatcherMode = "loop" | "manual";
/** Tuning for the outbox dispatcher. Every default suits a single laptop host. */
interface DispatcherOptions {
  /** `loop` (default) ticks on a timer and on `kick()`; `manual` only ticks when asked. */
  mode?: DispatcherMode;
  /** Interval between passes in `loop` mode. Default 500 ms. */
  tickMs?: number;
  /** Rows one stage claims per pass. Default 50. */
  batch?: number;
  /** How long a claim is held before another orchestrator may take the row. */
  claimHoldMs?: number;
  /** First backoff step after a refused push; doubles per dispatch attempt. */
  backoffBaseMs?: number;
  /** Ceiling on the push backoff. Default 60 s. */
  maxBackoffMs?: number;
  /** Backoff used when no transport serves the task's queue at all. */
  unroutableBackoffMs?: number;
  /** `fetch` used for HTTP pushes. Default `globalThis.fetch`; injected by tests. */
  fetch?: FetchLike;
  /** Recorded as `worker_id` on tasks this process dispatches. Default `vlo-<8 hex>`. */
  workerId?: string;
}
/** What one tick moved, per stage. The tick route answers with exactly this. */
interface TickCounts {
  /** `created` runs that received their `started` event. */
  started: number;
  /** Tasks a transport accepted and the journal recorded as running. */
  pushed: number;
  /** Timers that fired. */
  timers: number;
  /** Attempts failed for a lapsed lease. */
  reaped: number;
  /** Attempts the backstop failed for outliving `timeout_ms`. */
  timeouts: number;
  /** Closed child runs whose parent received its `child` event. */
  notified: number;
}
/**
 * The outbox dispatcher. `createHost` builds one per host holding the `orchestrator` role;
 * only tests and custom hosts construct it directly.
 */
declare class Dispatcher {
  private readonly ctx;
  private readonly options;
  private readonly mode;
  private readonly tickMs;
  private readonly batch;
  private readonly claimHoldMs;
  private readonly backoffBaseMs;
  private readonly maxBackoffMs;
  private readonly unroutableBackoffMs;
  private readonly workerId;
  private readonly deadlines;
  private readonly transports;
  /** Queues served by pollers: the push stage must leave their tasks unclaimed. */
  private readonly pullQueues;
  private timer;
  private current;
  private again;
  private stopped;
  /** Passes still running, whoever started them — the loop, a tick route, a drain. */
  private readonly passes;
  /** Reads the options once; nothing runs until {@link Dispatcher.start}. */
  constructor(ctx: HostContext, options?: DispatcherOptions);
  /** Begins ticking (`loop` mode) or merely arms `tick()` (`manual` mode). Idempotent. */
  start(): void;
  /**
   * Stops ticking and waits for every pass still in flight. The wait is what makes shutdown
   * safe: the host closes the journal next, and a stage halfway through a claim must not be
   * left reading a connection that is gone.
   */
  stop(): Promise<void>;
  /** Runs a tick soon. Safe to call from inside a tick: it queues one more pass. */
  kick(): void;
  /** One pass over every stage. The tick route and the tests drive the outbox with it. */
  tick(): Promise<TickCounts>;
  private pass;
  private schedule;
  private drain;
  private startRuns;
  private pushTasks;
  /** True when the task was accepted by a worker and recorded as running. */
  private pushOne;
  private backoff;
  private defer;
  private transportFor;
  private buildTransport;
  private notifyParents;
  private notifyParent;
  private markNotified;
  /**
   * Never throws and never writes to stdout: hosts listen on `events` if they care.
   * A closed journal is shutdown, not a fault — the host stopped while this was in flight —
   * so it is dropped rather than reported.
   */
  private warn;
}
//#endregion
//#region src/host/drain.d.ts
/** Wall-clock budget of a drain when `maxMs` is absent: 25 s, under a typical serverless `maxDuration`. */
declare const DEFAULT_DRAIN_MAX_MS = 25000;
interface DrainOptions {
  /** Wall-clock budget for the whole drain. Default 25 s. */
  maxMs?: number;
}
interface DrainResult {
  /** How many dispatcher passes ran. */
  passes: number;
  /** True when the drain stopped because there was nothing left, false when it ran out of time. */
  idle: boolean;
  /** The counts of the last pass. */
  counts: TickCounts;
}
/**
 * Ticks until a pass is quiet or the budget runs out. `Host.drain` wraps this and additionally
 * shares one drain between concurrent callers; call that unless you hold a `HostContext`.
 * Throws a plain `Error` on a context without the `orchestrator` role.
 *
 * @example
 * ```ts
 * // Inside a request on a `manual`-mode host: carry the run as far as it goes right now.
 * const result = await host.drain({ maxMs: 20_000 });
 * if (!result.idle) console.warn(`still busy after ${result.passes} passes`);
 * ```
 */
declare function drainHost(ctx: HostContext, options?: DrainOptions): Promise<DrainResult>;
//#endregion
//#region src/host/worker/registry.d.ts
/** Authoring form of `Usage` (camelCase, all optional); the wire form is snake_case. */
interface UsageInput {
  tokens?: number;
  costMicroUsd?: number;
  cpuMs?: number;
}
/** What a handler gets beside its input: identity of the attempt and the controls for it. */
interface TaskContext {
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
type ActivityHandler<I = Json, O = unknown> = (input: I, ctx: TaskContext) => O | Promise<O>;
/** Handler inputs are contravariant, so `never` accepts any concretely typed handler. */
type ActivityImpls = Record<string, ActivityHandler<never, unknown>>;
/** A defined worker: the value {@link defineWorker} returns and the host or config loader registers. */
interface Worker {
  /** Discriminator the config loader uses to find workers among a module's exports. */
  readonly kind: "worker";
  /** Queues this worker serves. */
  readonly queues: readonly string[];
  /** Handlers by activity name. */
  readonly handlers: ReadonlyMap<string, ActivityHandler<Json, unknown>>;
}
/** Options for {@link defineWorker}. */
interface WorkerOptions {
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
 * import { defineWorker } from "@vlo/sdk";
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
declare function defineWorker(impls: ActivityImpls, options?: WorkerOptions): Worker;
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
declare function withRetryInput<I, O>(handler: ActivityHandler<I, O>, shape: (input: I, attempt: number) => I): ActivityHandler<I, O>;
/** The first worker in this process that serves both the queue and the activity. */
declare function findWorker(workers: readonly Worker[], queue: string, activity: string): Worker | undefined;
//#endregion
//#region src/host/worker/handle-task.d.ts
/** Where a result goes: back into this process, or over HTTP to the host that pushed. */
interface TaskReporter {
  /** Reports the attempt's output. */
  complete(taskId: string, attempt: number, output: unknown, usage?: Usage): Promise<void>;
  /** Reports a failure; `retryable: false` skips the retry policy. `cause` defaults to `app_error`. */
  fail(taskId: string, attempt: number, error: string, retryable: boolean, usage?: Usage, cause?: Cause): Promise<void>;
  /** Extends the lease. Rejects once the lease is gone. */
  heartbeat(taskId: string, attempt: number): Promise<void>;
}
/** Knobs for {@link handleTask}. */
interface HandleTaskOptions {
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
declare function handleTask(worker: Worker, task: PushedTask, reporter: TaskReporter, options?: HandleTaskOptions): Promise<void>;
//#endregion
//#region src/host/transport/in-process.d.ts
/**
 * Counts handlers this process still owes a result for. One tracker is shared by every
 * in-process transport a host builds, because `Host.drain` has to tell "the dispatcher
 * moved nothing" apart from "the dispatcher moved nothing *yet*: a handler is running and
 * its result will schedule the next task".
 */
declare class InProcessTracker {
  private running;
  private done;
  private readonly waiting;
  /** Handlers started and not yet reported. */
  get inFlight(): number;
  /** Monotonic count of handlers that reported. A change across a tick means work landed. */
  get finished(): number;
  /** Counts a handler as started. */
  enter(): void;
  /** Counts a handler as reported; wakes `settled()` waiters when none are left. */
  leave(): void;
  /** Resolves once no in-process handler is outstanding. */
  settled(): Promise<void>;
}
/** Knobs for {@link InProcessTransport}. */
interface InProcessOptions {
  /** Shared with the host, so `Host.drain` can wait for handlers this transport started. */
  tracker?: InProcessTracker;
  /**
   * Where a failure to *report* goes. The handler's own throw is a task failure and the
   * reporter turns it into one; this is the reporter itself failing — a journal that closed
   * under a shutdown, typically — and without a home it would be an unhandled rejection.
   */
  onError?: (error: unknown) => void;
}
/** Runs tasks on a worker in this process. Built by the dispatcher for each `worker:<queue>` role. */
declare class InProcessTransport implements TaskTransport {
  private readonly worker;
  private readonly reporter;
  private readonly options;
  /** Always `in-process`. */
  readonly kind = "in-process";
  /** `reporter` is where the handler's result goes; usually `localReporter(ctx)`. */
  constructor(worker: Worker, reporter: TaskReporter, options?: InProcessOptions);
  /** Always accepts. The handler starts on the next macrotask, after the dispatcher has committed `running`. */
  push(task: PushedTask): Promise<PushResult>;
}
//#endregion
//#region src/host/context.d.ts
/**
 * The parts of a Zod schema the host actually uses. Structural, so `Activity` and
 * `SignalDef` satisfy it without the host importing zod — and without fighting the
 * invariance of `z.ZodType` when the registry erases the schema's type.
 */
interface Validator {
  /** Zod's `safeParse` shape: never throws, reports issues on failure. */
  safeParse(value: unknown): {
    success: true;
    data: unknown;
  } | {
    success: false;
    error: {
      message: string;
      issues: readonly {
        path: PropertyKey[];
        message: string;
      }[];
    };
  };
}
/**
 * An activity as the host knows it: a name and a validator for the worker's output.
 * `hash` and `jsonSchema` are present on real `Activity` values and drive registry
 * upserts on boot; a bare `{ name, output }` still validates.
 */
interface ActivityRegistration {
  /** Activity name, as the workflow schedules it. */
  readonly name: string;
  /** Validates a worker's output before it is folded; a failure fails the attempt with `schema_violation`. */
  readonly output: Validator;
  /** Content hash of the activity definition; the registry version. */
  readonly hash?: string;
  /** JSON Schema for both sides, written to the registry on boot when `hash` is also present. */
  readonly jsonSchema?: {
    input: unknown;
    output: unknown;
  };
  /** Retry policy, journaled next to the schema as byte-exact JSON. */
  readonly retry?: unknown;
}
/** A signal as the host knows it: a name and a validator for incoming payloads. */
interface SignalRegistration {
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
interface QueueConfig {
  /** Where to push tasks on this queue. Absent ⇒ in-process only. */
  url?: string;
  /** HMAC secret shared with the queue's worker. Required for HTTP push. */
  secret?: string;
  /** `push` (default) dispatches from the outbox; `pull` leaves tasks for `POST /v1/tasks/poll`. */
  mode?: "push" | "pull";
}
/** Every credential a host reads. All optional; an empty config is an open host. */
interface AuthConfig {
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
type Role = "orchestrator" | "api" | `worker:${string}`;
/** The shared state every host function takes as its first argument. Built by `createHost`. */
interface HostContext {
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
interface TaskScheduled {
  /** The run the task belongs to. */
  run_id: string;
  /** The scheduled task. */
  task_id: string;
  /** The queue it was scheduled on. */
  queue: string;
}
//#endregion
//#region src/host/domain.d.ts
/** What {@link defineDomain} takes. Every registry is optional. */
interface DomainDef {
  /** Name for diagnostics; two domains with the same name are refused. */
  name: string;
  /** Workflows this domain owns. */
  workflows?: readonly Workflow[];
  /** Workers run in-process for this domain. Each adds a `worker:<queue>` role when `roles` is absent. */
  workers?: readonly Worker[];
  /** Activities whose output the host validates. */
  activities?: readonly ActivityRegistration[];
  /** Signals whose payload the host validates. */
  signals?: readonly SignalRegistration[];
}
/** A defined domain: the value {@link defineDomain} returns and `createHost({ domains })` flattens. */
interface Domain {
  /** Discriminator, like `Worker.kind`. */
  readonly kind: "domain";
  /** The domain's name. */
  readonly name: string;
  /** Workflows this domain owns. */
  readonly workflows: readonly Workflow[];
  /** Workers run in-process for this domain. */
  readonly workers: readonly Worker[];
  /** Activities whose output the host validates. */
  readonly activities: readonly ActivityRegistration[];
  /** Signals whose payload the host validates. */
  readonly signals: readonly SignalRegistration[];
}
/** The four registries a host is built from, flattened. */
interface Registries {
  /** Every workflow, across domains and the flat option. */
  workflows: readonly Workflow[];
  /** Every worker. */
  workers: readonly Worker[];
  /** Every activity registration. */
  activities: readonly ActivityRegistration[];
  /** Every signal registration. */
  signals: readonly SignalRegistration[];
}
/**
 * Groups one area's workflows, workers, activities and signals under a name, for
 * `createHost({ domains: [...] })`.
 *
 * @example
 * ```ts
 * import { defineDomain } from "@vlo/sdk";
 * import { brandActivities } from "./activities.ts";
 * import { brandResearch, brandWeekly } from "./workflows.ts";
 * import { brandWorker } from "./worker.ts";
 *
 * export const brandDomain = defineDomain({
 *   name: "brand",
 *   workflows: [brandResearch, brandWeekly],
 *   workers: [brandWorker],
 *   activities: brandActivities,
 * });
 * ```
 */
declare function defineDomain(def: DomainDef): Domain;
/**
 * Flattens `domains` onto the flat registries. Throws a `TypeError` when two domains share
 * a name, or when two different workflow or activity values are registered under one name;
 * the same value registered twice is fine.
 */
declare function mergeDomains(options: Partial<Registries> & {
  domains?: readonly Domain[];
}): Registries;
//#endregion
//#region src/core/run-status.d.ts
/** The statuses a run never leaves: `completed`, `failed`, `cancelled`, `continued`. */
declare const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus>;
/** True when the run accepts no further events. */
declare function isTerminalRunStatus(status: RunStatus): boolean;
//#endregion
export { HashAtSeq as $, withRetryInput as A, HttpPushOptions as B, ActivityImpls as C, WorkerOptions as D, Worker as E, Dispatcher as F, Handlers as G, PushResult as H, DispatcherMode as I, Workflow as J, Reduction as K, DispatcherOptions as L, DrainOptions as M, DrainResult as N, defineWorker as O, drainHost as P, DeriveIdsOutput as Q, TickCounts as R, ActivityHandler as S, UsageInput as T, PushedTask as U, HttpPushTransport as V, TaskTransport as W, WorkflowFailure as X, WorkflowDef as Y, defineWorkflow as Z, InProcessTracker as _, Registries as a, PrepareEventInput as at, TaskReporter as b, ActivityRegistration as c, RefoldCheckOutput as ct, QueueConfig as d, Kernel as et, Role as f, InProcessOptions as g, Validator as h, DomainDef as i, PlanRetryInput as it, DEFAULT_DRAIN_MAX_MS as j, findWorker as k, AuthConfig as l, RetryPlan as lt, TaskScheduled as m, isTerminalRunStatus as n, KernelResult as nt, defineDomain as o, Prepared as ot, SignalRegistration as p, ReductionWire as q, Domain as r, KernelVersion as rt, mergeDomains as s, ReduceStepInput as st, TERMINAL_RUN_STATUSES as t, KernelError as tt, HostContext as u, BlobStore as ut, InProcessTransport as v, TaskContext as w, handleTask as x, HandleTaskOptions as y, FetchLike as z };