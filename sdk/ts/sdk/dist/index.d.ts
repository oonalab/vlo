import { A as withRetryInput, C as ActivityImpls, D as WorkerOptions, E as Worker, G as Handlers, J as Workflow, K as Reduction, O as defineWorker, S as ActivityHandler, X as WorkflowFailure, Y as WorkflowDef, Z as defineWorkflow, f as Role, i as DomainDef, n as isTerminalRunStatus, o as defineDomain, q as ReductionWire, r as Domain, t as TERMINAL_RUN_STATUSES, w as TaskContext } from "./run-status-B5GxnHVb.js";
import { D as RetryPolicy, O as RunStatus, S as Json, T as ReducerEvent, _ as Cause, g as Backoff, j as Usage, k as Status, v as Command, x as Jitter } from "./types-BkQ6NGIA.js";
import { z } from "zod";
//#region src/core/activity.d.ts
/**
 * Retry policy an activity gets when {@link ActivityOptions.retry} is omitted: three
 * attempts, exponential backoff from 1 s to a 10 min cap, factor 2, full jitter. Each
 * field is also the fallback for any {@link RetryOptions} field left unset.
 */
export declare const DEFAULT_RETRY: RetryPolicy;
/**
 * Queue an activity is dispatched on when {@link ActivityOptions.queue} is omitted, and the
 * queue a worker serves when {@link WorkerOptions.queues} is omitted.
 */
export declare const DEFAULT_QUEUE = "default";
/** Lease a worker holds before it must heartbeat. Long tasks heartbeat, they do not raise this. */
export declare const DEFAULT_LEASE_MS = 60000;
/**
 * Authoring form of {@link RetryPolicy} (camelCase, all optional); the wire form is
 * snake_case. Every omitted field falls back to {@link DEFAULT_RETRY}.
 */
interface RetryOptions {
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
/** What {@link activity} needs: the two Zod schemas plus optional dispatch knobs. */
interface ActivityOptions<I extends z.ZodType, O extends z.ZodType> {
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
interface Activity<I = unknown, O = unknown> {
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
  readonly jsonSchema: {
    input: Json;
    output: Json;
  };
}
/**
 * A defined signal: the value {@link signal} returns, passed to `cmd.awaitSignal`,
 * `cmd.awaitHuman` and {@link waitFor}. `T` is the inferred payload type.
 */
interface SignalDef<T = unknown> {
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
export declare function activity<I extends z.ZodType, O extends z.ZodType>(name: string, options: ActivityOptions<I, O>): Activity<z.infer<I>, z.infer<O>>;
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
export declare function signal<S extends z.ZodType>(name: string, schema: S): SignalDef<z.infer<S>>;
//#endregion
//#region src/core/commands.d.ts
/** Thrown synchronously by `cmd.task` when the input does not match the activity's schema. */
export declare class ActivityInputError extends Error {
  /** Name of the activity whose input schema rejected the value. */
  readonly activity: string;
  /** @param detail - The Zod issues, joined as `path: message; …`. */
  constructor(activity: string, detail: string);
}
/** Per-call overrides for `cmd.task`. */
interface TaskOptions {
  /** Step id. Defaults to a kernel-derived id; set it when a phase fans out. */
  id?: string;
  /** Queue for this task only. Defaults to the activity's `queue`. */
  queue?: string;
}
/** When a `cmd.timer` fires. Exactly one of `ms` / `atMs` is required. */
interface TimerOptions {
  /** Delay in milliseconds, counted from the timestamp of the event being reduced. */
  ms?: number;
  /** Absolute epoch time in milliseconds. */
  atMs?: number;
  /** Step id. Defaults to a kernel-derived id. */
  id?: string;
}
/** Per-call overrides for `cmd.spawn`. */
interface SpawnOptions {
  /** Step id of the child step. Defaults to a kernel-derived id. */
  id?: string;
}
/** Per-call overrides for `cmd.awaitSignal`. */
interface AwaitSignalOptions {
  /** Step id of the wait. Defaults to a kernel-derived id. */
  id?: string;
  /**
   * Deadline for the wait, counted from the timestamp of the event being reduced. A `timer`
   * event with step id `<id>:timeout` reaches the reducer when the deadline passes; the
   * losing side of the race is cancelled by the kernel. Requires an explicit `id`.
   */
  timeoutMs?: number;
}
/**
 * Requests one attempt-tracked execution of `target` with `input`.
 *
 * `input` is parsed with the activity's Zod schema; the parsed value (defaults applied) is
 * what travels. The activity's `queue`, `retry`, `leaseMs` and `timeoutMs` are copied onto
 * the command; `options.queue` overrides the queue for this call.
 *
 * @throws {@link ActivityInputError} when the input does not match the activity's schema.
 */
declare function task<I, O>(target: Activity<I, O>, input: I, options?: TaskOptions): Command;
/**
 * Schedules a `timer` event for the run. `ms` is relative to the timestamp of the event
 * being reduced; `atMs` is absolute epoch milliseconds.
 *
 * Throws a `TypeError` synchronously when neither or both of `ms` / `atMs` are given.
 */
declare function timer(options: TimerOptions): Command;
/**
 * Starts a child run of `workflow` (a name, or anything with a `name` such as a
 * {@link Workflow}) with `input`. The child's terminal status and output come back to this
 * run as a `child_done` event on the spawn's step id. The workflow must be registered on
 * the host that dispatches the command.
 */
declare function spawn(workflow: string | {
  name: string;
}, input: Json, options?: SpawnOptions): Command;
/**
 * Parks the run until a signal named after `definition` is delivered; the payload arrives
 * on a `signal` event. A signal that arrived before the wait was opened is buffered and
 * delivered immediately, oldest first. The run holds no compute while parked. With
 * `timeoutMs` the kernel also opens a timer step `<id>:timeout` and cancels whichever of
 * the two loses; see {@link signalTimeoutStepId}.
 */
declare function awaitSignal<T>(definition: SignalDef<T>, options?: AwaitSignalOptions): Command;
/**
 * Publishes `data` on a side channel. Emits never enter the run's history and never come
 * back to the reducer; the host forwards them to event-stream subscribers, which is where
 * progress ticks and UI hints belong.
 */
declare function emit(channel: string, data: Json): Command;
/**
 * Closes the run as `completed` with `output`. It must be the last command of the reduction;
 * the kernel rejects any command after it.
 */
declare function complete(output: Json): Command;
/**
 * Closes the run as `continued`, carrying `input` as the start input of a successor run. It
 * must be the last command of the reduction. The host starts the successor (same workflow,
 * this `input`) in the same transaction and links the two runs by `continued_from` and
 * `continued_to`; a parent run is notified once, by the run that finally closes.
 */
declare function continueAsNew(input: Json): Command;
interface AwaitHumanOptions {
  /** Step id of the wait. The deadline timer is `${id}:timeout`, so it is required. */
  id: string;
  /** Deadline for the reply. Without one the run waits forever. */
  timeoutMs?: number;
  /** Rendered by whatever asks the human — "context travels with the ask". */
  context?: Json;
}
/**
 * Step id of the timer the kernel pairs with a signal wait `id` that carries a
 * `timeoutMs`. A `timer` event with this step id means the deadline won the race.
 */
export declare function signalTimeoutStepId(id: string): string;
/** @deprecated Use {@link signalTimeoutStepId}; same string. */
export declare const humanTimeoutStepId: typeof signalTimeoutStepId;
/**
 * Ask a human. Sugar over `await_signal` (with its deadline) + `emit`: the wait reserves
 * `id` and the kernel opens `${id}:timeout` beside it, so whichever arrives first wins and
 * the kernel cancels the loser. Returns commands — spread it into a reduction.
 */
declare function awaitHuman<T>(definition: SignalDef<T>, options: AwaitHumanOptions): Command[];
/**
 * The command constructors a reducer returns to the engine. Each builds a plain
 * {@link Command}; nothing runs until the host applies the reduction. `task`, `timer`,
 * `spawn` and `awaitSignal` open a step, `emit` records a side effect, `complete` and
 * `continueAsNew` close the run and must come last.
 *
 * @example
 * ```ts
 * import { cmd, defineWorkflow } from "@vlo/sdk";
 * import { approve, work } from "./activities.ts";
 *
 * export default defineWorkflow("review", {
 *   init: (input: { item: string }) => ({ item: input.item, upper: null as string | null }),
 *   on: {
 *     started: (s) => [s, [cmd.task(work, { item: s.item })]],
 *     task_done: (s, e) => [
 *       { ...s, upper: (e.output as { upper: string }).upper },
 *       cmd.awaitHuman(approve, { id: "approval", timeoutMs: 86_400_000 }),
 *     ],
 *     signal: (s) => [s, [cmd.complete({ upper: s.upper })]],
 *     timer: (s) => [s, [cmd.complete(null)]],
 *   },
 * });
 * ```
 */
export declare const cmd: {
  /** Runs an activity once, with retries. Throws {@link ActivityInputError} on bad input. */
  readonly task: typeof task;
  /** Fires a `timer` event after `ms` or at `atMs`. */
  readonly timer: typeof timer;
  /** Starts a child run; its result arrives as `child_done`. */
  readonly spawn: typeof spawn;
  /** Parks the run until the named signal is delivered. */
  readonly awaitSignal: typeof awaitSignal;
  /** `awaitSignal` with a deadline + `emit("human", …)`; returns a `Command[]`. */
  readonly awaitHuman: typeof awaitHuman;
  /** Publishes on a side channel; never journaled. */
  readonly emit: typeof emit;
  /** Closes the run as `completed`. Must be last. */
  readonly complete: typeof complete;
  /** Closes the run as `continued` with a fresh start input. Must be last. */
  readonly continueAsNew: typeof continueAsNew;
};
//#endregion
//#region src/core/helpers/sequence-types.d.ts
/** Progress of a {@link fanOut} or {@link fanOutRuns} phase in flight; absent from {@link SeqState} otherwise. */
interface FanState {
  /** Name of the activity or workflow being fanned out. */
  activity: string;
  /** Number of items `select` returned. */
  total: number;
  /** Index of the next item to dispatch. */
  next: number;
  /** Step ids currently in flight. */
  outstanding: string[];
  /** Outputs by item index; `null` until that item's task or child run settles. */
  outputs: Json[];
}
/**
 * State of a workflow built by {@link sequence}. `mapInput`, `select`, `when` and `output`
 * callbacks read it; the run completes with `results` (or `output(state)`) as its output.
 */
interface SeqState {
  /** Index of the phase currently in flight. */
  phase: number;
  /** The run's start input. */
  input: Json;
  /** Outputs of finished {@link step}, {@link fanOut} and {@link fanOutRuns} phases, keyed by activity or workflow name. */
  results: Record<string, Json>;
  /** Payloads of finished {@link waitFor} phases, keyed by signal name; `null` after a `"continue"` timeout. */
  signals: Record<string, Json>;
  /** Present only while a {@link fanOut} or {@link fanOutRuns} phase is in flight. */
  fan?: FanState;
  /**
   * The run's banked usage as of the last folded event (`event.usage_total`). Absent on a
   * checkpoint written before any event was folded with this field.
   */
  usage?: Usage;
}
/** An activity with its input and output types erased, as `sequence` stores it; Zod still validates every input. */
type ErasedActivity = Activity<Json, Json>;
/** What a phase does when its task or child run did not succeed. Default: `"fail"`. */
type OnFailure = "fail" | "continue";
/** Options for {@link step}. */
interface StepOptions {
  /** Explicit step id; default: the kernel-derived `task#n`. Set it when a handler keys on the step id. */
  id?: string;
  /** `"fail"` (default) fails the run on a task that did not succeed; `"continue"` stores `null` and advances. */
  onFailure?: OnFailure;
  /** Pure gate evaluated when the phase is entered; `false` stores `null` and advances without a task. */
  when?: (state: SeqState) => boolean;
}
/** Options for {@link fanOut}. */
interface FanOutOptions {
  /** Maximum tasks in flight at once; an integer ≥ 1. */
  concurrency: number;
  /** `"fail"` (default) fails the run on any task that did not succeed; `"continue"` stores `null` for that item. */
  onFailure?: OnFailure;
}
/** Options for {@link fanOutRuns}. */
interface FanOutRunsOptions {
  /** Maximum child runs in flight at once; an integer ≥ 1. */
  concurrency: number;
  /** `"fail"` (default) fails the run on any child that did not complete; `"continue"` records its status and moves on. */
  onFailure?: OnFailure;
}
/** The terminal status a child run reports to its parent, mapped from the child's run status. */
type ChildStatus = "succeeded" | "failed" | "cancelled";
/** One child's outcome as {@link fanOutRuns} stores it. */
interface ChildResult<O = Json> {
  /** `succeeded` for a completed child, else `failed` or `cancelled`. */
  status: ChildStatus;
  /** The child's completion output; `null` unless it completed. */
  output: O | null;
  /** The child's run id, for a journal read of its own events. */
  child_run_id: string;
}
/** Options for {@link sequence}. */
interface SequenceOptions {
  /** Shapes the completion output; default: `state.results`. Pure. */
  output?: (state: SeqState) => Json;
}
/**
 * One phase of a {@link sequence}, as built by {@link step}, {@link fanOut}, {@link fanOutRuns},
 * {@link waitFor} or {@link sleep}. Treat it as opaque; the shape is exposed for inspection only.
 */
type SeqStep = {
  /** A single task. */
  readonly kind: "step";
  /** Key in `results`: the activity name. */
  readonly key: string;
  /** The activity to run. */
  readonly activity: ErasedActivity;
  /** Builds the task input from state; absent means "the previous phase's value". */
  readonly mapInput?: (state: SeqState) => Json;
  /** Explicit step id; absent means kernel-derived. */
  readonly id?: string;
  /** What a task that did not succeed does; absent means `"fail"`. */
  readonly onFailure?: OnFailure;
  /** Gate evaluated on phase entry; absent means always run. */
  readonly when?: (state: SeqState) => boolean;
} | {
  /** One task per selected item. */
  readonly kind: "fan_out";
  /** Key in `results`: the activity name. */
  readonly key: string;
  /** The activity to run per item. */
  readonly activity: ErasedActivity;
  /** Pure selector of the items; re-evaluated on every event of the phase. */
  readonly select: (state: SeqState) => Json[];
  /** Maximum tasks in flight at once. */
  readonly concurrency: number;
  /** What a task that did not succeed does; absent means `"fail"`. */
  readonly onFailure?: OnFailure;
} | {
  /** One child run per selected item. */
  readonly kind: "fan_out_runs";
  /** Key in `results`: the workflow name. */
  readonly key: string;
  /** The workflow to spawn per item. */
  readonly workflow: string;
  /** Pure selector of the child inputs; re-evaluated on every event of the phase. */
  readonly select: (state: SeqState) => Json[];
  /** Maximum child runs in flight at once. */
  readonly concurrency: number;
  /** What a child that did not complete does; absent means `"fail"`. */
  readonly onFailure?: OnFailure;
} | {
  /** A parked wait for a signal. */
  readonly kind: "wait_for";
  /** Key in `signals`: the signal name. */
  readonly key: string;
  /** The signal to wait for. */
  readonly signal: SignalDef<Json>;
  /** Deadline in milliseconds; absent means wait forever. */
  readonly timeoutMs?: number;
  /** What the deadline does; absent means `"fail"`. */
  readonly onTimeout?: OnTimeout;
  /** Emitted on the `human` channel when the wait opens. */
  readonly context?: Json;
} | {
  /** A timer that stores nothing. */
  readonly kind: "sleep";
  /** Duration in milliseconds. */
  readonly ms: number;
};
/** What a `waitFor` deadline does when it fires first. Default: `"fail"`. */
type OnTimeout = "fail" | "continue";
/** Deadline and presentation options for {@link waitFor}. */
interface WaitForOptions {
  /** Deadline in milliseconds, counted from when the wait opens. Absent: the run waits forever. */
  timeoutMs?: number;
  /** `"fail"` (default) fails the run at the deadline; `"continue"` advances with a `null` payload. */
  onTimeout?: OnTimeout;
  /** Emitted on the `human` channel alongside the wait, for whatever renders the ask. */
  context?: Json;
}
//#endregion
//#region src/core/helpers/sequence.d.ts
/**
 * A {@link sequence} phase that runs `target` once.
 *
 * Without `mapInput` the task input is the run's start input for phase 0 and the previous
 * phase's stored value afterwards (sleeps are skipped). The output is stored in
 * `results[target.name]`. A task that does not succeed fails the run, unless
 * `onFailure: "continue"` stores `null` instead; `when` returning `false` also stores `null`
 * and skips the task. `id` pins the step id for handlers that key on it.
 *
 * @example
 * ```ts
 * import { defineWorkflow, resultOf, sequence, step } from "@vlo/sdk";
 * import { finish, notify, plan } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" })),
 *   step(notify, undefined, { onFailure: "continue", when: (s) => resultOf(s, plan).items.length > 0 }),
 * ]));
 * ```
 */
export declare function step<I, O>(target: Activity<I, O>, mapInput?: (state: SeqState) => I, options?: StepOptions): SeqStep;
/**
 * A {@link sequence} phase that runs `target` once per item `select` returns, at most
 * `concurrency` at a time, with step ids `${target.name}#${index}`.
 *
 * `select` must be pure and read only state written by earlier phases: it is re-evaluated
 * on every event of the phase and the run fails if it returns a different count. Outputs
 * are stored in `results[target.name]` in item order; an empty selection stores `[]` and
 * moves on. A task that does not succeed fails the run, unless `onFailure: "continue"`
 * stores `null` for that item.
 *
 * Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
 *
 * @example
 * ```ts
 * import { defineWorkflow, fanOut, resultOf, sequence, step } from "@vlo/sdk";
 * import { plan, work } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   fanOut(work, (state) => resultOf(state, plan).items.map((item) => ({ item })), { concurrency: 2 }),
 * ]));
 * ```
 */
export declare function fanOut<I, O>(target: Activity<I, O>, select: (state: SeqState) => I[], options: FanOutOptions): SeqStep;
/**
 * A {@link sequence} phase that spawns one child run of `target` per item `select` returns,
 * at most `concurrency` at a time, with step ids `${workflow}#${index}`.
 *
 * `select` has the same purity rule as {@link fanOut}. Each item is the child's start input.
 * The phase stores a {@link ChildResult} per item in `results[workflow]`, in item order;
 * read it with {@link fanOutRunsResultsOf}. An empty selection stores `[]` and moves on.
 * A child that did not complete fails the run, unless `onFailure: "continue"` records its
 * status and moves on. The child workflow must be registered on the same host.
 *
 * Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
 *
 * @example
 * ```ts
 * import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, resultOf, sequence, step } from "@vlo/sdk";
 * import { plan, summarise } from "./activities.ts";
 * import { readSource } from "./read-source.workflow.ts";
 *
 * export default defineWorkflow("research", sequence([
 *   step(plan),
 *   fanOutRuns(readSource, (s) => resultOf(s, plan).sourceIds.map((sourceId) => ({ sourceId })), {
 *     concurrency: 5,
 *     onFailure: "continue",
 *   }),
 *   step(summarise, (s) => ({ read: fanOutRunsResultsOf(s, readSource).filter((r) => r.status === "succeeded").length })),
 * ]));
 * ```
 */
export declare function fanOutRuns<I extends Json = Json>(target: string | {
  readonly name: string;
}, select: (state: SeqState) => I[], options: FanOutRunsOptions): SeqStep;
/**
 * A {@link sequence} phase that parks the run until `definition` is delivered.
 *
 * The payload is stored in `signals[definition.name]`. With `timeoutMs` the wait races the
 * kernel's paired deadline timer (the loser is cancelled): `onTimeout: "fail"` (default)
 * fails the run, `"continue"` stores `null` and advances. `context` is emitted on the
 * `human` channel when the wait opens. A signal or deadline arriving for a phase already
 * left behind is ignored.
 *
 * @example
 * ```ts
 * import { defineWorkflow, sequence, signalOf, step, waitFor } from "@vlo/sdk";
 * import { approve, finish, plan } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail", context: { what: "plan" } }),
 *   step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by })),
 * ]));
 * ```
 */
export declare function waitFor<T>(definition: SignalDef<T>, options?: WaitForOptions): SeqStep;
/**
 * A {@link sequence} phase that parks the run on a timer for `ms` milliseconds. It stores
 * nothing: the phase after it receives the value of the last phase that stored one.
 *
 * @example
 * ```ts
 * import { defineWorkflow, sequence, sleep, step } from "@vlo/sdk";
 * import { plan, finish } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   sleep(60_000),
 *   step(finish, (state) => ({ uppers: [], approvedBy: "timer" })),
 * ]));
 * ```
 */
export declare function sleep(ms: number): SeqStep;
/**
 * Compiles an ordered list of phases into a {@link WorkflowDef} for {@link defineWorkflow}.
 *
 * Phases run one after another: {@link step}, {@link fanOut}, {@link fanOutRuns},
 * {@link waitFor} and {@link sleep}. Outputs go to `results` keyed by activity or workflow
 * name and signal payloads to `signals` keyed by signal name, so two phases on the same
 * target share a key. After the last phase the run completes with `results`, or with
 * `options.output(state)`. `state.usage` always holds the run's banked usage as of the
 * last event. Events that do not belong to the current phase are ignored: state
 * unchanged, no commands.
 *
 * @example
 * ```ts
 * import {
 *   defineWorkflow, fanOut, fanOutResultsOf, resultOf, sequence, signalOf, step, waitFor,
 * } from "@vlo/sdk";
 * import { approve, finish, plan, work } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   fanOut(work, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2 }),
 *   waitFor(approve),
 *   step(finish, (s) => ({
 *     uppers: fanOutResultsOf(s, work).map((o) => o.upper),
 *     approvedBy: signalOf(s, approve).by,
 *   })),
 * ], { output: (s) => ({ report: resultOf(s, finish).report, tokens: s.usage?.tokens ?? 0 }) }));
 * ```
 */
export declare function sequence(steps: readonly SeqStep[], options?: SequenceOptions): WorkflowDef<SeqState, Json>;
//#endregion
//#region src/core/helpers/sequence-access.d.ts
/**
 * The output of an earlier {@link step} on `target`, typed as the activity's output.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" }))
 * ```
 */
export declare function resultOf<I, O>(state: SeqState, target: Activity<I, O>): O;
/**
 * The outputs of an earlier {@link fanOut} on `target`, in item order. An empty
 * selection stored `[]`.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({
 *   uppers: fanOutResultsOf(state, work).map((output) => output.upper),
 *   approvedBy: "auto",
 * }))
 * ```
 */
export declare function fanOutResultsOf<I, O>(state: SeqState, target: Activity<I, O>): O[];
/**
 * The outcomes of an earlier {@link fanOutRuns} on `target`, in item order: one
 * {@link ChildResult} per child, whose `output` is `null` unless the child completed. An
 * empty selection stored `[]`. `O` is the child workflow's completion output type.
 *
 * @example
 * ```ts
 * step(summarise, (state) => ({
 *   read: fanOutRunsResultsOf<{ ok: boolean }>(state, readSource).filter((r) => r.output?.ok).length,
 * }))
 * ```
 */
export declare function fanOutRunsResultsOf<O = Json>(state: SeqState, target: string | {
  readonly name: string;
}): ChildResult<O>[];
/**
 * The payload an earlier {@link waitFor} on `definition` received, typed as the signal's
 * payload. After an `onTimeout: "continue"` deadline the stored value is `null`, which
 * this returns as-is; narrow it yourself when that option is in play.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by }))
 * ```
 */
export declare function signalOf<T>(state: SeqState, definition: SignalDef<T>): T;
//#endregion
//#region src/core/hash.d.ts
/**
 * Deterministic JSON: object keys sorted recursively, arrays in order, no whitespace.
 * Throws on anything JSON cannot represent losslessly (undefined, NaN, Infinity, bigint,
 * function, symbol) rather than silently dropping it, because a dropped field would make
 * two different schemas hash the same.
 */
export declare function canonicalJson(value: unknown): string;
/** Full SHA-256 of `data` as 64 lowercase hex characters; strings are hashed as UTF-8. */
export declare function sha256Hex(data: string | Uint8Array): string;
/** SHA-256 of the canonical encoding, truncated to `HASH_CHARS`. */
export declare function contentHash(value: unknown): string;
//#endregion
//#region src/core/schema-projection.d.ts
/** Version tag folded into every activity and signal hash. Bump when the projection changes. */
export declare const SCHEMA_HASH_VERSION = 1;
/** Keywords removed from every schema object before hashing, at any depth. */
export declare const ANNOTATION_KEYWORDS: readonly string[];
/**
 * Keywords whose value is a map from a user-chosen name to a schema. The names are opaque
 * (a property may be called `default`), only the values are schemas.
 */
export declare const NAMED_SCHEMA_MAPS: readonly string[];
/**
 * Returns a copy of `schema` with every annotation keyword removed from every schema
 * object in it. Arrays are walked (`anyOf`, `prefixItems`, …) in order; the entries of a
 * name-keyed map (`properties`, `$defs`, …) keep their names and have their values
 * projected; scalars pass through. The input is never mutated.
 */
export declare function projectSchema(schema: Json): Json;
//#endregion
//#region src/config/define.d.ts
/** A reference to an environment variable, as {@link env} builds it. Resolved at load time. */
interface EnvRef {
  /** Name of the environment variable. */
  readonly __env: string;
  /** When `true`, an unset or empty variable resolves to "absent" instead of failing the load. */
  readonly optional?: boolean;
}
/** A literal value, or the name of the environment variable holding it. */
type Ref = string | EnvRef;
/**
 * Refers to an environment variable by name so a secret never sits in `vlo.config.ts`.
 *
 * The value is read when the profile is loaded, not when `env` is called. An unset or empty
 * variable fails the load with a message naming the variable, unless `optional` is `true`,
 * in which case the field is simply absent.
 *
 * @example
 * ```ts
 * import { defineConfig, env } from "@vlo/sdk";
 *
 * export default defineConfig({
 *   workflows: ["*.workflow.ts"],
 *   profiles: {
 *     prod: {
 *       journal: env("DATABASE_URL"),
 *       auth: { token: env("VLO_TOKEN"), pushSecret: env("VLO_PUSH_SECRET", { optional: true }) },
 *     },
 *   },
 * });
 * ```
 */
export declare function env(name: string, options?: {
  optional?: boolean;
}): EnvRef;
/**
 * How tasks on one queue reach their workers. A queue with neither `url` nor `mode` is
 * served only by a worker in the same process.
 */
interface QueueProfile {
  /** Endpoint the dispatcher pushes tasks to, payload included. */
  url?: Ref;
  /** HMAC secret shared with the worker behind `url`; required for an HTTP push. */
  secret?: Ref;
  /** `"push"` delivers to `url`; `"pull"` never pushes and lets workers long-poll the host instead. */
  mode?: "push" | "pull";
}
/** Outbox dispatcher settings for a profile holding the `orchestrator` role. */
interface DispatcherProfile {
  /** `manual` never arms the interval: something outside must call the tick route. */
  mode?: "loop" | "manual";
  /** Interval between dispatcher passes in `loop` mode, in milliseconds. Default `500`. */
  tickMs?: number;
}
/** Platform `vlo deploy` renders templates for. */
type DeployTarget = "cloud-run" | "vercel";
/** What `vlo deploy` needs to write templates. Never a secret — only names and regions. */
interface DeployProfile {
  /** Which set of templates to render. */
  target: DeployTarget;
  /** Cloud project id, where the target needs one. */
  project?: Ref;
  /** Region the service runs in. Default `europe-west4`. */
  region?: Ref;
  /**
   * First segment of every generated resource name: `<namePrefix>-<env>-<service>`. Must
   * equal the `prefix` of each entry in the Terraform `local.envs` the templates join.
   * Default `vlo`.
   */
  namePrefix?: Ref;
  /** Component name inside the per-env prefix, e.g. `<namePrefix>-<env>-<service>`. Default `vlo`. */
  service?: Ref;
  /** Bucket for offloaded payloads. Defaults to the bucket named by a `gcs://` `blob` URL. */
  bucket?: Ref;
  /** Terraform envs this profile is deployed to. Default `["staging", "prod"]`. */
  envs?: readonly string[];
  /** Middle segment of the generated Secret Manager secret ids. Default `vlo`. */
  secretName?: Ref;
  /** Cron expression driving the tick route on serverless targets. Default every minute. */
  cron?: Ref;
}
/** One environment's wiring: where state lives, how queues deliver, which roles run. */
interface Profile {
  /** @deprecated Use `publicUrl`. Kept so existing configs keep loading. */
  host?: Ref;
  /** Base URL peers reach this host on. Fills `complete_url` on an outbound push. */
  publicUrl?: Ref;
  /** Journal URL: `sqlite://<path>` or a Postgres connection string. Required. */
  journal: Ref;
  /** Blob store URL for payloads over the inline limit: `file://<dir>` or `gcs://<bucket>/<prefix>`. Default `file://.vlo/blobs`. */
  blob?: Ref;
  /** Delivery settings per queue name; see {@link QueueProfile}. */
  queues?: Record<string, QueueProfile>;
  /** `token`: bearer for the control-plane routes. `pushSecret`: HMAC secret inbound pushes are verified with. */
  auth?: {
    token?: Ref;
    pushSecret?: Ref;
  };
  /** Port `vlo serve` listens on. `--port` and `PORT` take precedence. */
  port?: number;
  /** Roles this process runs. Absent ⇒ orchestrator + api + every in-process worker. */
  roles?: readonly Role[];
  /** Outbox dispatcher settings; see {@link DispatcherProfile}. */
  dispatcher?: DispatcherProfile;
  /** Template inputs for `vlo deploy`; see {@link DeployProfile}. */
  deploy?: DeployProfile;
}
/** The shape of `vlo.config.ts`'s default export; build it with {@link defineConfig}. */
interface VloConfig {
  /** Globs, relative to the config file. Every matching module is imported. */
  workflows: string | readonly string[];
  /** Globs of modules exporting {@link defineWorker} results. */
  workers?: string | readonly string[];
  /** Optional: modules exporting `activity()` / `signal()` definitions to register. */
  activities?: string | readonly string[];
  /**
   * Named environments; at least one is required. `vlo dev` picks `local` when present, else
   * the only profile, unless `--profile` / `VLO_PROFILE` names one; `serve`, `doctor` and
   * `deploy` always need a name.
   */
  profiles: Record<string, Profile>;
}
/**
 * Types and checks a `vlo.config.ts` and returns it unchanged for `export default`.
 *
 * Throws a `TypeError` when `profiles` is empty. Values wrapped with {@link env} are
 * resolved later, when the CLI loads the profile.
 *
 * @example
 * ```ts
 * import { defineConfig, env } from "@vlo/sdk";
 *
 * export default defineConfig({
 *   workflows: ["./workflows/*.workflow.ts"],
 *   workers: ["./workers/*.worker.ts"],
 *   profiles: {
 *     local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
 *     prod: {
 *       journal: env("DATABASE_URL"),
 *       auth: { token: env("VLO_TOKEN") },
 *       roles: ["orchestrator", "api"],
 *       queues: { media: { mode: "pull" } },
 *       dispatcher: { mode: "manual" },
 *       deploy: { target: "vercel", cron: "* * * * *" },
 *     },
 *   },
 * });
 * ```
 */
export declare function defineConfig(config: VloConfig): VloConfig;
//#endregion
export { type Activity, type ActivityHandler, type ActivityImpls, type ActivityOptions, type AwaitHumanOptions, type AwaitSignalOptions, type Backoff, type Cause, type ChildResult, type ChildStatus, type Command, type DeployProfile, type DeployTarget, type DispatcherProfile, type Domain, type DomainDef, type EnvRef, type ErasedActivity, type FanOutOptions, type FanOutRunsOptions, type FanState, type Handlers, type Jitter, type Json, type OnFailure, type OnTimeout, type Profile, type QueueProfile, type ReducerEvent, type Reduction, type ReductionWire, type Ref, type RetryOptions, type RetryPolicy, type RunStatus, type SeqState, type SeqStep, type SequenceOptions, type SignalDef, type SpawnOptions, type Status, type StepOptions, TERMINAL_RUN_STATUSES, type TaskContext, type TaskOptions, type TimerOptions, type Usage, type VloConfig, type WaitForOptions, type Worker, type WorkerOptions, type Workflow, type WorkflowDef, WorkflowFailure, defineDomain, defineWorker, defineWorkflow, isTerminalRunStatus, withRetryInput };