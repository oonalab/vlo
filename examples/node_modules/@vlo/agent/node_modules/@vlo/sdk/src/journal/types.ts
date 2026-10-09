/**
 * The journal contract: the only durable-state surface the host may touch.
 *
 * Rows mirror the DDL in `migrations/{pg,sqlite}/0001_init.sql` one-to-one.
 * Every instant is a millisecond epoch named `*_ms` so both dialects and these
 * rows agree on one representation. Columns that are NULL in the database are
 * absent from the row rather than `undefined`-valued, which keeps
 * `exactOptionalPropertyTypes` honest.
 */

import type {
  Envelope,
  Json,
  RetryPolicy,
  RunStatus,
  Status,
  Transition,
} from "../kernel/protocol.ts";

/** One row of `runs`. */
export interface RunRow {
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
export interface StateRow {
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
export interface TaskRow {
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
export interface TimerRow {
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
export interface SignalWaitRow {
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
export interface SignalRow {
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
export interface SchemaRow {
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
export interface NewRunRow {
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
export interface NewSignalRow {
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
export interface ApplyTransitionOptions {
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
export interface RunQuery {
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
export interface TaskClaimFilter {
  /** Only this queue. */
  queue?: string;
  /** Every queue but these. */
  excludeQueues?: readonly string[];
}

/** Reads outside a transaction, plus the transaction entry point. */
export interface Journal {
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
export class JournalClosed extends Error {
  /** Always `journal_closed`. */
  readonly code = "journal_closed";

  /** `dialect` names the implementation, e.g. `sqlite` or `postgres`. */
  constructor(dialect: string) {
    super(`vlo journal: the ${dialect} journal is closed`);
    this.name = "JournalClosed";
  }
}

/** One transaction. Every method is serialised against the run it touches. */
export interface JournalTx {
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

  // Outbox and leases.
  /** Claims schedulable, undispatched tasks for `holdMs`; concurrent claimers get disjoint sets. */
  claimUndispatchedTasks(
    nowMs: number,
    limit: number,
    holdMs: number,
    filter?: TaskClaimFilter,
  ): Promise<TaskRow[]>;
  /** False when the attempt moved on or the task is no longer scheduled. */
  markDispatched(
    taskId: string,
    attempt: number,
    nowMs: number,
    leaseUntilMs: number,
    workerId?: string,
  ): Promise<boolean>;
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

  // Timers and signals.
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

  // Registry.
  /** Inserts the schema; a row with the same `(name, version)` is left untouched. */
  upsertSchema(row: SchemaRow, nowMs: number): Promise<void>;
  /** The schema row, or null. */
  getSchema(name: string, version: string): Promise<SchemaRow | null>;
}
