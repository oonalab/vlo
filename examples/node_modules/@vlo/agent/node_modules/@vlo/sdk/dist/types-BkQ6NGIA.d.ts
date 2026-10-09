//#region src/kernel/transition.d.ts
/** The run row as the kernel needs it to prepare or reduce an event. */
interface RunRef {
  /** Run id. */
  run_id: string;
  /** Workflow name. */
  workflow: string;
  /** Digest of the workflow the run pinned when it started. */
  bundle_digest: string;
  /** Current run status. */
  status: RunStatus;
  /** Sequence number of the last journaled event; `0` before `started`. */
  last_seq: number;
  /** Parent run, for a child run. */
  parent_run_id?: string;
  /** The parent's `spawn` step, for a child run. */
  parent_step_id?: string;
}
/** Columns of the run row the transition updates. */
interface RunPatch {
  /** Run status after the event. */
  status: RunStatus;
  /** Sequence number of the event just applied. */
  last_seq: number;
}
/** A task row to insert: the outbox entry a worker will receive. */
interface NewTask {
  /** Deterministic task id, derived from run, step and attempt. */
  task_id: string;
  /** Step id inside the run. */
  step_id: string;
  /** Attempt number, starting at 1. */
  attempt: number;
  /** Activity name. */
  activity: string;
  /** Queue the task is pushed to or polled from. */
  queue: string;
  /** Schema reference for input validation, when the activity declares one. */
  schema_ref?: string;
  /** Task input. */
  input: Json;
  /** Idempotency key the worker echoes so a duplicate push is harmless. */
  idempotency_key: string;
  /** Retry policy the host applies on failure. */
  retry: RetryPolicy;
  /** Lease duration in milliseconds; the reaper reclaims a task past it. */
  lease_ttl_ms: number;
  /** Execution timeout in milliseconds; absent means no timeout. */
  timeout_ms?: number;
}
/** A status change on an existing task row. */
interface TaskUpdate {
  /** Task id. */
  task_id: string;
  /** Attempt the update applies to. */
  attempt: number;
  /** New task status. */
  status: Status;
  /** Earliest time in milliseconds the task may run again; set on a retry. */
  not_before_ms?: number;
}
/** A timer row to insert. */
interface NewTimer {
  /** Step id inside the run. */
  step_id: string;
  /** When the timer fires, in milliseconds since the epoch. */
  fire_at_ms: number;
}
/** A child run to start. */
interface NewSpawn {
  /** The parent's step id. */
  step_id: string;
  /** Deterministic id of the child run. */
  child_run_id: string;
  /** Workflow the child runs. */
  workflow: string;
  /** The child's start input. */
  input: Json;
}
/** A signal wait row to insert: the run is parked until a signal with this name arrives. */
interface SignalWait {
  /** Step id inside the run. */
  step_id: string;
  /** Signal name. */
  name: string;
  /** Schema reference for payload validation, when the signal declares one. */
  schema_ref?: string;
  /** Deadline in milliseconds since the epoch; absent means wait forever. */
  expires_at_ms?: number;
}
/** A side-channel emission; delivered in memory, never journaled. */
interface Emit {
  /** Channel name. */
  channel: string;
  /** Payload. */
  data: Json;
}
/** The run's terminal outcome, present when the event closed the run. */
interface Completion {
  /** Terminal status. */
  status: RunStatus;
  /** Output, when the run completed. */
  output?: Json;
}
/** The write-set. Journals apply it atomically and never interpret commands. */
interface Transition {
  /** Run row patch. */
  run: RunPatch;
  /** Kernel state after the event. */
  kernel_state: KernelState;
  /** User state after the event, byte-exact JSON. */
  state: string;
  /** Hash of kernel state plus user state. */
  state_hash: string;
  /** Whether `state` is stored inline or offloaded to the blob store. */
  state_inline: boolean;
  /** Events to append: the triggering event plus any markers. */
  events: Envelope[];
  /** Tasks to insert. */
  tasks: NewTask[];
  /** Task rows to update. */
  task_updates: TaskUpdate[];
  /** Timers to insert. */
  timers: NewTimer[];
  /** Child runs to start. */
  spawns: NewSpawn[];
  /** Signal waits to open. */
  signal_waits: SignalWait[];
  /** Side-channel emissions. */
  emits: Emit[];
  /** Present when the run reached a terminal status. */
  completion?: Completion;
  /** Present when the run continued as new; carries the successor's input. */
  continue_as_new?: {
    input: Json;
  };
}
//#endregion
//#region src/kernel/protocol.d.ts
type Kind = "task" | "timer" | "signal" | "child" | "marker";
/**
 * Status of one step (a task, timer, signal wait or child), as carried on every event.
 * `scheduled` → `running` → `succeeded` | `failed` | `retrying` | `cancelled`;
 * `awaiting_signal` is a parked wait. `succeeded`, `failed` and `cancelled` are terminal.
 */
type Status = "scheduled" | "running" | "succeeded" | "failed" | "retrying" | "cancelled" | "awaiting_signal";
/**
 * Why a step or run failed. `timeout`: the attempt ran past `timeout_ms`; `heartbeat_lost`:
 * the lease expired; `app_error`: the handler or reducer threw; `user_cancel`: cancelled
 * through the API; `schema_violation`: a worker's output failed the output schema;
 * `nondeterminism_detected`: a re-fold diverged from the journal. The last three never retry.
 */
type Cause = "timeout" | "heartbeat_lost" | "app_error" | "user_cancel" | "schema_violation" | "nondeterminism_detected";
/**
 * Status of a run. `created` until `started` is folded, then `running` or
 * `awaiting_signal`; `completed`, `failed`, `cancelled` and `continued` are terminal.
 */
type RunStatus = "created" | "running" | "awaiting_signal" | "completed" | "failed" | "cancelled" | "continued";
/**
 * Resources an attempt consumed, as banked by the kernel. Integers only, never negative:
 * the total is hashed into the kernel state.
 */
interface Usage {
  /** CPU time in milliseconds. */
  cpu_ms: number;
  /** Model tokens, prompt and completion together. */
  tokens: number;
  /** Cost in millionths of a US dollar. */
  cost_micro_usd: number;
}
/** Any JSON value. Inputs, outputs, payloads and workflow state are all `Json` on the wire. */
type Json = null | boolean | number | string | Json[] | {
  [key: string]: Json;
};
/** An event as the host submits it, before `seq` and `state_hash` are assigned. */
interface EventInput {
  run_id: string;
  step_id: string;
  attempt: number;
  kind: Kind;
  status: Status;
  cause?: Cause;
  usage?: Usage;
  ts_ms: number;
  /** 32 hex chars of host-generated randomness, journaled. */
  random: string;
  schema_ref?: string;
  /** Inline JSON payload, byte-exact. Exactly one of payload / payload_ref. */
  payload?: string;
  payload_ref?: string;
  error?: string;
}
/** A journaled event. */
interface Envelope extends EventInput {
  seq: number;
  parent_run_id?: string;
  parent_step_id?: string;
  state_hash: string;
}
/** `fixed` repeats `initial_ms`; `exponential` multiplies it by `factor` per attempt. */
type Backoff = "fixed" | "exponential";
/** `full` scales each delay by a journaled random fraction in [0, 1); `none` leaves it. */
type Jitter = "none" | "full";
/**
 * Wire form of a retry policy; the authoring form is `RetryOptions`. The delay before
 * attempt `n + 1` is `initial_ms` (fixed) or `initial_ms · factor^(n − 1)` (exponential),
 * capped at `max_ms`, then jittered. Retrying stops at `max_attempts` or on a cause that
 * never retries.
 */
interface RetryPolicy {
  /** Attempts in total, the first one included. */
  max_attempts: number;
  /** Delay growth strategy. */
  backoff: Backoff;
  /** Delay before the second attempt, in milliseconds. */
  initial_ms: number;
  /** Ceiling on any single delay, in milliseconds. */
  max_ms: number;
  /** Growth multiplier for exponential backoff; ≤ 1 behaves like fixed. */
  factor: number;
  /** Jitter applied to every delay. */
  jitter: Jitter;
}
/**
 * A command as a reducer returns it and the kernel validates it. Build them with `cmd.*`.
 * `task`, `timer`, `spawn` and `await_signal` open a step and take an optional step `id`
 * (default: kernel-derived, `${type}#${step_no}`); `complete` and `continue_as_new` must be last.
 */
type Command = {
  /** Run an activity. */
  type: "task";
  /** Activity name. */
  activity: string;
  /** `name@hash` of the activity, recorded on the step's events. */
  schema_ref?: string;
  /** Validated task input. */
  input: Json;
  /** Queue to dispatch on. Default `"default"`. */
  queue?: string;
  /** Retry policy. Default: the kernel's own. */
  retry?: RetryPolicy;
  /** Lease per attempt, in milliseconds. Default: the kernel's own. */
  lease_ttl_ms?: number;
  /** Wall-clock budget for one attempt: the worker aborts at it, the host reaps past it. */
  timeout_ms?: number;
  /** Explicit step id. */
  id?: string;
} | {
  /** Fire a `timer` event. Exactly one of `fire_in_ms` / `fire_at_ms`. */
  type: "timer";
  /** Delay from the reduced event's `ts_ms`, in milliseconds. */
  fire_in_ms?: number;
  /** Absolute epoch time, in milliseconds. */
  fire_at_ms?: number;
  /** Explicit step id. */
  id?: string;
} | {
  /** Start a child run. */
  type: "spawn";
  /** Workflow name. */
  workflow: string;
  /** The child's start input. */
  input: Json;
  /** Explicit step id. */
  id?: string;
} | {
  /** Park until a signal is delivered. */
  type: "await_signal";
  /** Signal name. */
  name: string;
  /** `name@hash` of the signal. */
  schema_ref?: string;
  /** Recorded as the wait's `expires_at_ms`; not enforced by the host. */
  timeout_ms?: number;
  /** Explicit step id. */
  id?: string;
} | {
  /** Publish on a side channel; never journaled. */
  type: "emit";
  /** Channel name. */
  channel: string;
  /** The payload. */
  data: Json;
} | {
  /** Close the run as `completed`. */
  type: "complete";
  /** The run's output. */
  output: Json;
} | {
  /** Close the run as `continued`. */
  type: "continue_as_new";
  /** Start input for the successor run. */
  input: Json;
};
interface Reduction {
  /** User state, byte-exact JSON. */
  state: string;
  commands: Command[];
}
interface StepState {
  kind: Kind;
  status: Status;
  attempt: number;
  activity?: string;
  queue?: string;
  retry?: RetryPolicy;
  child_run_id?: string;
  signal?: string;
  fire_at_ms?: number;
}
interface KernelState {
  v: number;
  status: RunStatus;
  step_no: number;
  steps: Record<string, StepState>;
  closed_steps: number;
  usage_total: Usage;
}
/**
 * `usage_total` rides on every variant: the run's banked total *including* this event, so a
 * reducer can decide on a budget without keeping its own tally.
 */
type ReducerEvent = {
  /** The run's first event. */
  type: "started";
  /** Journaled event time, epoch milliseconds — the reducer's only clock. */
  ts_ms: number;
  /** 32 hex chars of journaled randomness — the reducer's only entropy. */
  random: string;
  /** The start input, as given to `init`. */
  input: Json;
  /** The run's banked usage including this event. */
  usage_total: Usage;
} | {
  /** A task reached a terminal status. */
  type: "task_done";
  /** Journaled event time, epoch milliseconds. */
  ts_ms: number;
  /** 32 hex chars of journaled randomness. */
  random: string;
  /** Step id of the task. */
  step_id: string;
  /** The attempt that produced this result. */
  attempt: number;
  /** Activity name. */
  activity: string;
  /** `succeeded`, `failed` or `cancelled`. */
  status: Status;
  /** Validated output; present when `succeeded`. */
  output?: Json;
  /** Why it did not succeed. */
  cause?: Cause;
  /** Error message from the worker or host. */
  error?: string;
  /** What this attempt itself consumed; zeroed when the worker reported none. */
  usage: Usage;
  /** The run's banked usage including this event. */
  usage_total: Usage;
} | {
  /** A signal the run was waiting on was delivered. */
  type: "signal";
  /** Journaled event time, epoch milliseconds. */
  ts_ms: number;
  /** 32 hex chars of journaled randomness. */
  random: string;
  /** Step id of the wait. */
  step_id: string;
  /** Signal name. */
  name: string;
  /** Validated payload. */
  payload: Json;
  /** The run's banked usage including this event. */
  usage_total: Usage;
} | {
  /** A timer fired. */
  type: "timer";
  /** Journaled event time, epoch milliseconds. */
  ts_ms: number;
  /** 32 hex chars of journaled randomness. */
  random: string;
  /** Step id of the timer. */
  step_id: string;
  /** The run's banked usage including this event. */
  usage_total: Usage;
} | {
  /** A child run closed. */
  type: "child_done";
  /** Journaled event time, epoch milliseconds. */
  ts_ms: number;
  /** 32 hex chars of journaled randomness. */
  random: string;
  /** Step id of the spawn. */
  step_id: string;
  /** The child's run id. */
  child_run_id: string;
  /** `succeeded`, `failed` or `cancelled`, mapped from the child's run status. */
  status: Status;
  /** The child's output; present when it completed. */
  output?: Json;
  /** The run's banked usage including this event. */
  usage_total: Usage;
};
//#endregion
//#region src/journal/types.d.ts
/** One row of `runs`. */
interface RunRow {
  /** Primary key. */
  run_id: string;
  /** Namespace the run was created in. */
  namespace: string;
  /** Workflow name. */
  workflow: string;
  /** Digest of the workflow bundle the run was started with; a checkpoint from another digest is rebuilt. */
  component_digest: string;
  /** Current status. */
  status: RunStatus;
  /** Seq of the last journaled event; 0 before `started`. */
  last_seq: number;
  /** Parent run, for a spawned child. */
  parent_run_id?: string;
  /** The parent's step that spawned this run. */
  parent_step_id?: string;
  /** The run this one continued from (`continue_as_new`). */
  continued_from?: string;
  /** The successor run a `continued` run handed its input to; set with the `continue` marker. */
  continued_to?: string;
  /** Inline start input, byte-exact JSON. */
  input?: string;
  /** Blob reference for an offloaded start input. */
  input_ref?: string;
  /** Inline completion output, byte-exact JSON. */
  output?: string;
  /** Blob reference for an offloaded completion output. */
  output_ref?: string;
  /** Caller-supplied search attributes. */
  search: Record<string, Json>;
  /** Free-form assignee, for human-facing queues. Unused by the host. */
  assignee?: string;
  /** Row creation, epoch milliseconds. */
  created_at_ms: number;
  /** Last change, epoch milliseconds. */
  updated_at_ms: number;
  /** When the `started` event was folded, epoch milliseconds. */
  started_at_ms?: number;
  /** When the run reached a terminal status, epoch milliseconds. */
  closed_at_ms?: number;
  /** When the parent received this child's `child` event, epoch milliseconds. */
  parent_notified_at_ms?: number;
  /** Outbox claim held by the "start runs" stage. */
  start_claimed_until_ms?: number;
  /** Outbox claim held by the "notify parents" stage. */
  notify_claimed_until_ms?: number;
}
/** The checkpoint: rewritten on every transition, in the transition's own transaction. */
interface StateRow {
  /** The run this checkpoint belongs to; one row per run. */
  run_id: string;
  /** Seq of the last event folded into it. */
  seq: number;
  /** Digest of the bundle that produced it. */
  bundle_digest: string;
  /** Kernel-owned state, byte-exact JSON text. */
  kernel_state: string;
  /** User state, byte-exact JSON text. Exactly one of `state` / `state_ref`. */
  state?: string;
  /** Blob reference for an offloaded user state. */
  state_ref?: string;
  /** Kernel hash of `(kernel_state, state)`; checked before every fold. */
  state_hash: string;
}
/** One row of `tasks`: a scheduled activity attempt and its outbox and lease bookkeeping. */
interface TaskRow {
  /** Primary key, derived by the kernel from `(run_id, step_id)`. */
  task_id: string;
  /** The run that scheduled it. */
  run_id: string;
  /** The workflow step. */
  step_id: string;
  /** Current attempt, starting at 1. */
  attempt: number;
  /** Activity name. */
  activity: string;
  /** Registered schema version the output is checked against. */
  schema_ref?: string;
  /** Queue the task is delivered on. */
  queue: string;
  /** Inline input, byte-exact JSON. */
  input?: string;
  /** Blob reference for an offloaded input. */
  input_ref?: string;
  /** Retry policy the kernel plans retries with. */
  retry_policy: RetryPolicy;
  /** Task status: `scheduled`, `running`, `retrying`, `succeeded`, `failed` or `cancelled`. */
  status: Status;
  /** Stable per attempt; the worker dedupes on it. */
  idempotency_key: string;
  /** Earliest dispatch time, epoch milliseconds; pushed back by retries and deferrals. */
  not_before_ms: number;
  /** When this attempt was handed to a worker, epoch milliseconds. */
  dispatched_at_ms?: number;
  /** Pushes tried for this attempt; drives the backoff. */
  dispatch_attempts: number;
  /** Outbox claim held by the push stage, epoch milliseconds. */
  dispatch_claimed_until_ms?: number;
  /** Lease length in milliseconds; a heartbeat extends the lease by this much. */
  lease_ttl_ms: number;
  /** Wall-clock budget for one attempt, measured from `dispatched_at_ms`. */
  timeout_ms?: number;
  /** When the current lease lapses, epoch milliseconds. */
  lease_until_ms?: number;
  /** Worker id recorded at dispatch. */
  worker_id?: string;
  /** Last heartbeat, epoch milliseconds. */
  heartbeat_at_ms?: number;
  /** Row creation, epoch milliseconds. */
  created_at_ms: number;
  /** Last change, epoch milliseconds. */
  updated_at_ms: number;
}
/** One row of `timers`. Keyed by `(run_id, step_id)`. */
interface TimerRow {
  /** The run that set it. */
  run_id: string;
  /** The workflow step. */
  step_id: string;
  /** When it is due, epoch milliseconds. */
  fire_at_ms: number;
  /** When it fired, epoch milliseconds; set exactly once. */
  fired_at_ms?: number;
  /** Outbox claim held by the fire-timers stage, epoch milliseconds. */
  claimed_until_ms?: number;
}
/** One row of `signal_waits`: a step parked on a named signal. */
interface SignalWaitRow {
  /** The waiting run. */
  run_id: string;
  /** The waiting step. */
  step_id: string;
  /** Signal name waited for. */
  name: string;
  /** Registered schema version of the signal. */
  schema_ref?: string;
  /** Wait deadline, epoch milliseconds. */
  expires_at_ms?: number;
}
/** One row of `signals`: a delivered or buffered signal. */
interface SignalRow {
  /** Primary key. */
  signal_id: string;
  /** The run it was sent to. */
  run_id: string;
  /** Signal name. */
  name: string;
  /** Inline payload, byte-exact JSON. */
  payload?: string;
  /** Blob reference for an offloaded payload. */
  payload_ref?: string;
  /** Free-form sender. Unused by the host. */
  sender?: string;
  /** Row creation, epoch milliseconds. */
  created_at_ms: number;
  /** When it was folded into the run, epoch milliseconds; absent while buffered. */
  delivered_at_ms?: number;
  /** The step it was delivered to. */
  delivered_step_id?: string;
}
/** One row of `schemas`: an activity or signal definition, keyed by `(name, version)`. */
interface SchemaRow {
  /** Activity or signal name. */
  name: string;
  /** Content hash of the definition. */
  version: string;
  /** JSON Schema text. */
  json_schema: string;
  /** Byte-exact JSON: it is part of the activity content hash. */
  retry_policy?: string;
}
/** What `createRun` inserts; timestamps and counters are filled by the journal. */
interface NewRunRow {
  /** Primary key. */
  run_id: string;
  /** Namespace. Default `"default"`. */
  namespace?: string;
  /** Workflow name. */
  workflow: string;
  /** Digest of the workflow bundle. */
  component_digest: string;
  /** Always `created`; the outbox starts the run. */
  status: "created";
  /** Parent run, for a spawned child. */
  parent_run_id?: string;
  /** The parent's spawning step. */
  parent_step_id?: string;
  /** The run this one continues from. */
  continued_from?: string;
  /** Inline start input, byte-exact JSON. */
  input?: string;
  /** Blob reference for an offloaded start input. */
  input_ref?: string;
  /** Caller-supplied search attributes. */
  search?: Record<string, Json>;
}
/** What `putSignal` inserts. */
interface NewSignalRow {
  /** Primary key. */
  signal_id: string;
  /** The run it is sent to. */
  run_id: string;
  /** Signal name. */
  name: string;
  /** Inline payload, byte-exact JSON. */
  payload?: string;
  /** Blob reference for an offloaded payload. */
  payload_ref?: string;
  /** Free-form sender. */
  sender?: string;
}
/** Host-side decisions `applyTransition` needs on top of the kernel's write-set. */
interface ApplyTransitionOptions {
  /** Timestamp for every row written, epoch milliseconds. */
  nowMs: number;
  /** Set when the user state was offloaded to the blob store; stores `state_ref`. */
  stateRef?: string;
  /** Set when the completion output was offloaded; stores `output_ref`. */
  outputRef?: string;
  /** Defaults to the run's `component_digest`. */
  bundleDigest?: string;
  /** Child runs the host derived from `transition.spawns`; journals never interpret commands. */
  childRuns?: NewRunRow[];
  /**
   * The successor the host derived from `transition.continue_as_new`. Inserted as a `created`
   * row and linked back by setting `continued_to` on the run being closed, in the same
   * transaction.
   */
  successorRun?: NewRunRow;
}
/** Filters for `Journal.query`. All optional; every given field must match. */
interface RunQuery {
  /** Namespace to list. */
  namespace?: string;
  /** Status to match. */
  status?: RunStatus;
  /** Workflow name to match. */
  workflow?: string;
  /** Maximum rows, newest first. */
  limit?: number;
}
/**
 * Which queues a task claim may take. `queue` is what a puller asks for; `excludeQueues`
 * is what the push dispatcher leaves alone because pollers own those queues.
 */
interface TaskClaimFilter {
  /** Only this queue. */
  queue?: string;
  /** Every queue but these. */
  excludeQueues?: readonly string[];
}
/** Reads outside a transaction, plus the transaction entry point. */
interface Journal {
  /** Idempotent, safe to run from several processes at once. */
  migrate(): Promise<void>;
  /** Runs `fn` in one transaction: committed when it resolves, rolled back when it rejects. */
  transaction<T>(fn: (tx: JournalTx) => Promise<T>): Promise<T>;
  /** Events with `seq > sinceSeq`, ascending. */
  readEvents(runId: string, sinceSeq?: number): Promise<Envelope[]>;
  /** The run row, or null. */
  getRun(runId: string): Promise<RunRow | null>;
  /** The run's checkpoint, or null before its first fold. */
  getState(runId: string): Promise<StateRow | null>;
  /** The task row, or null. */
  getTask(taskId: string): Promise<TaskRow | null>;
  /** Every task of a run. */
  listTasks(runId: string): Promise<TaskRow[]>;
  /** Runs matching the query. */
  query(q: RunQuery): Promise<RunRow[]>;
  /** Unfired timers with `fire_at_ms <= nowMs`. Read-only; the dispatcher claims via `claimDueTimers`. */
  dueTimers(nowMs: number, limit: number): Promise<TimerRow[]>;
  /** Running attempts whose `lease_until_ms` has passed. */
  expiredLeases(nowMs: number, limit: number): Promise<TaskRow[]>;
  /**
   * Running attempts past their `timeout_ms`. The backstop for a worker that never answers:
   * the worker's own timer covers the case where it is alive enough to report.
   */
  expiredTimeouts(nowMs: number, limit: number): Promise<TaskRow[]>;
  /** Releases the connection(s). Idempotent; every call afterwards throws {@link JournalClosed}. */
  close(): Promise<void>;
}
/**
 * Thrown by every journal call made after `close()`.
 *
 * Shutdown is inherently racy: a worker reporting a result, a stage finishing its pass. The
 * contract is that those calls fail with this, one recognisable error, instead of whatever
 * the driver does to a closed handle — `node:sqlite` raises `ERR_INVALID_STATE` from a
 * finalized statement, which surfaces as a crash rather than as "the host is stopping".
 */
declare class JournalClosed extends Error {
  /** Always `journal_closed`. */
  readonly code = "journal_closed";
  /** `dialect` names the implementation, e.g. `sqlite` or `postgres`. */
  constructor(dialect: string);
}
/** One transaction. Every method is serialised against the run it touches. */
interface JournalTx {
  /** Takes the per-run write lock for the rest of the transaction, then reads the run. */
  lockRun(runId: string): Promise<RunRow | null>;
  /** Idempotent on `run_id`. */
  createRun(row: NewRunRow, nowMs: number): Promise<void>;
  /** The run's checkpoint, or null before its first fold. */
  getState(runId: string): Promise<StateRow | null>;
  /** Events with `seq > sinceSeq`, ascending. */
  readEvents(runId: string, sinceSeq?: number): Promise<Envelope[]>;
  /**
   * Applies a kernel write-set atomically: events (seq taken from each envelope,
   * with the `(run_id, seq)` primary key as the backstop), the checkpoint, new
   * tasks, task updates, timers, signal waits, child runs, the successor run and the run row.
   */
  applyTransition(runId: string, t: Transition, opts: ApplyTransitionOptions): Promise<void>;
  /** Claims schedulable, undispatched tasks for `holdMs`; concurrent claimers get disjoint sets. */
  claimUndispatchedTasks(nowMs: number, limit: number, holdMs: number, filter?: TaskClaimFilter): Promise<TaskRow[]>;
  /** False when the attempt moved on or the task is no longer scheduled. */
  markDispatched(taskId: string, attempt: number, nowMs: number, leaseUntilMs: number, workerId?: string): Promise<boolean>;
  /** Releases the dispatch claim and backs the task off to `notBeforeMs`. */
  deferDispatch(taskId: string, attempt: number, notBeforeMs: number): Promise<void>;
  /** False unless the task is running at that attempt. */
  heartbeat(taskId: string, attempt: number, leaseUntilMs: number, nowMs: number): Promise<boolean>;
  /** `created` runs not yet started, claimed for `holdMs`; concurrent claimers get disjoint sets. */
  claimCreatedRuns(nowMs: number, limit: number, holdMs: number): Promise<RunRow[]>;
  /** Closed child runs whose parent has not been told yet, claimed for `holdMs`. */
  claimClosedUnnotified(nowMs: number, limit: number, holdMs: number): Promise<RunRow[]>;
  /** Sets `parent_notified_at_ms`, so the child is never claimed again. */
  markParentNotified(runId: string, nowMs: number): Promise<void>;
  /** Due, unfired timers, claimed for `holdMs`; concurrent claimers get disjoint sets. */
  claimDueTimers(nowMs: number, limit: number, holdMs: number): Promise<TimerRow[]>;
  /** False when the timer already fired; timers are deduped by `step_id`. */
  markTimerFired(runId: string, stepId: string, nowMs: number): Promise<boolean>;
  /** Stores a signal, undelivered. */
  putSignal(row: NewSignalRow, nowMs: number): Promise<void>;
  /** Oldest undelivered signal of that name. Does not mark it delivered. */
  takeSignal(runId: string, name: string): Promise<SignalRow | null>;
  /** Records which step consumed the signal. */
  markSignalDelivered(signalId: string, stepId: string, nowMs: number): Promise<void>;
  /** Steps of the run currently parked on a signal. */
  getSignalWaits(runId: string): Promise<SignalWaitRow[]>;
  /** Drops a wait once its signal was delivered. */
  removeSignalWait(runId: string, stepId: string): Promise<void>;
  /** Inserts the schema; a row with the same `(name, version)` is left untouched. */
  upsertSchema(row: SchemaRow, nowMs: number): Promise<void>;
  /** The schema row, or null. */
  getSchema(name: string, version: string): Promise<SchemaRow | null>;
}
//#endregion
export { StepState as A, TaskUpdate as B, KernelState as C, RetryPolicy as D, Reduction as E, NewTask as F, NewTimer as I, RunPatch as L, Completion as M, Emit as N, RunStatus as O, NewSpawn as P, RunRef as R, Json as S, ReducerEvent as T, Transition as V, Cause as _, NewRunRow as a, EventInput as b, RunRow as c, SignalWaitRow as d, StateRow as f, Backoff as g, TimerRow as h, JournalTx as i, Usage as j, Status as k, SchemaRow as l, TaskRow as m, Journal as n, NewSignalRow as o, TaskClaimFilter as p, JournalClosed as r, RunQuery as s, ApplyTransitionOptions as t, SignalRow as u, Command as v, Kind as w, Jitter as x, Envelope as y, SignalWait as z };