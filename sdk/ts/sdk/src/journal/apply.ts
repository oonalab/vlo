/**
 * Applying one kernel write-set.
 *
 * The journal never interprets commands: it writes exactly the rows the kernel
 * asked for, in one transaction, and lets the `(run_id, seq)` primary key be the
 * backstop against a double append.
 */

import type { NewTask, NewTimer, RunStatus, SignalWait, Status, TaskUpdate, Transition } from "../kernel/protocol.ts";
import type { Envelope } from "../kernel/protocol.ts";
import { jsonParam, orNull, type Executor, type SqlParam } from "./dialect.ts";
import type { ApplyTransitionOptions, NewRunRow } from "./types.ts";

const TERMINAL_RUN_STATUS: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "completed",
  "failed",
  "cancelled",
  "continued",
]);

const TERMINAL_TASK_STATUS: ReadonlySet<Status> = new Set<Status>([
  "succeeded",
  "failed",
  "cancelled",
]);

const INSERT_RUN = `
  INSERT INTO runs (
    run_id, namespace, workflow, component_digest, status, last_seq,
    parent_run_id, parent_step_id, continued_from, input, input_ref, search,
    created_at_ms, updated_at_ms
  ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (run_id) DO NOTHING`;

const INSERT_EVENT = `
  INSERT INTO events (
    run_id, seq, step_id, attempt, kind, status, cause, schema_ref, payload,
    payload_ref, error, usage, random, state_hash, parent_run_id, parent_step_id, ts_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPSERT_STATE = `
  INSERT INTO run_state (run_id, seq, bundle_digest, kernel_state, state, state_ref, state_hash)
  VALUES (?, ?, COALESCE(?, (SELECT component_digest FROM runs WHERE run_id = ?)), ?, ?, ?, ?)
  ON CONFLICT (run_id) DO UPDATE SET
    seq = excluded.seq,
    bundle_digest = excluded.bundle_digest,
    kernel_state = excluded.kernel_state,
    state = excluded.state,
    state_ref = excluded.state_ref,
    state_hash = excluded.state_hash`;

/**
 * A replay of the same attempt is a no-op; a retry at a higher attempt resets
 * the outbox and lease columns so the dispatcher picks the task up again.
 */
const UPSERT_TASK = `
  INSERT INTO tasks (
    task_id, run_id, step_id, attempt, activity, schema_ref, queue, input,
    retry_policy, status, idempotency_key, not_before_ms, dispatch_attempts,
    lease_ttl_ms, timeout_ms, created_at_ms, updated_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, 0, ?, ?, ?, ?)
  ON CONFLICT (task_id) DO UPDATE SET
    attempt = excluded.attempt,
    activity = excluded.activity,
    schema_ref = excluded.schema_ref,
    queue = excluded.queue,
    input = excluded.input,
    retry_policy = excluded.retry_policy,
    status = 'scheduled',
    idempotency_key = excluded.idempotency_key,
    not_before_ms = excluded.not_before_ms,
    dispatched_at_ms = NULL,
    dispatch_attempts = 0,
    dispatch_claimed_until_ms = NULL,
    lease_until_ms = NULL,
    worker_id = NULL,
    heartbeat_at_ms = NULL,
    lease_ttl_ms = excluded.lease_ttl_ms,
    timeout_ms = excluded.timeout_ms,
    updated_at_ms = excluded.updated_at_ms
  WHERE tasks.attempt < excluded.attempt`;

const RESCHEDULE_TASK = `
  UPDATE tasks SET
    status = ?, attempt = ?, not_before_ms = ?, updated_at_ms = ?,
    dispatched_at_ms = NULL, dispatch_claimed_until_ms = NULL,
    lease_until_ms = NULL, worker_id = NULL
  WHERE task_id = ?`;

const CLOSE_TASK = `
  UPDATE tasks SET
    status = ?, attempt = ?, updated_at_ms = ?,
    lease_until_ms = NULL, dispatch_claimed_until_ms = NULL
  WHERE task_id = ?`;

const SET_TASK_STATUS = `
  UPDATE tasks SET status = ?, attempt = ?, updated_at_ms = ? WHERE task_id = ?`;

const INSERT_TIMER = `
  INSERT INTO timers (run_id, step_id, fire_at_ms) VALUES (?, ?, ?)
  ON CONFLICT (run_id, step_id) DO NOTHING`;

const INSERT_SIGNAL_WAIT = `
  INSERT INTO signal_waits (run_id, step_id, name, schema_ref, expires_at_ms)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (run_id, step_id) DO NOTHING`;

const UPDATE_RUN = `
  UPDATE runs SET
    status = ?,
    last_seq = ?,
    updated_at_ms = ?,
    started_at_ms = COALESCE(started_at_ms, ?),
    output = COALESCE(?, output),
    output_ref = COALESCE(?, output_ref),
    closed_at_ms = COALESCE(closed_at_ms, ?),
    continued_to = COALESCE(?, continued_to)
  WHERE run_id = ?`;

export async function insertRun(x: Executor, row: NewRunRow, nowMs: number): Promise<void> {
  await x.run(INSERT_RUN, [
    row.run_id,
    row.namespace ?? "default",
    row.workflow,
    row.component_digest,
    row.status,
    orNull(row.parent_run_id),
    orNull(row.parent_step_id),
    orNull(row.continued_from),
    orNull(row.input),
    orNull(row.input_ref),
    jsonParam(row.search ?? {}),
    nowMs,
    nowMs,
  ]);
}

export async function applyTransition(
  x: Executor,
  runId: string,
  t: Transition,
  opts: ApplyTransitionOptions,
): Promise<void> {
  const now = opts.nowMs;
  for (const event of t.events) await insertEvent(x, runId, event);
  await upsertState(x, runId, t, opts);
  for (const task of t.tasks) await upsertTask(x, runId, task, now);
  for (const update of t.task_updates) await applyTaskUpdate(x, update, now);
  for (const timer of t.timers) await insertTimer(x, runId, timer);
  for (const wait of t.signal_waits) await insertSignalWait(x, runId, wait);
  for (const child of opts.childRuns ?? []) await insertRun(x, child, now);
  if (opts.successorRun !== undefined) await insertRun(x, opts.successorRun, now);
  await updateRun(x, runId, t, opts);
}

async function insertEvent(x: Executor, runId: string, e: Envelope): Promise<void> {
  await x.run(INSERT_EVENT, [
    runId,
    e.seq,
    e.step_id,
    e.attempt,
    e.kind,
    e.status,
    orNull(e.cause),
    orNull(e.schema_ref),
    orNull(e.payload),
    orNull(e.payload_ref),
    orNull(e.error),
    e.usage ? jsonParam(e.usage) : null,
    e.random,
    e.state_hash,
    orNull(e.parent_run_id),
    orNull(e.parent_step_id),
    e.ts_ms,
  ]);
}

async function upsertState(
  x: Executor,
  runId: string,
  t: Transition,
  opts: ApplyTransitionOptions,
): Promise<void> {
  const offloaded = opts.stateRef !== undefined;
  await x.run(UPSERT_STATE, [
    runId,
    t.run.last_seq,
    orNull(opts.bundleDigest),
    runId,
    jsonParam(t.kernel_state),
    offloaded ? null : t.state,
    orNull(opts.stateRef),
    t.state_hash,
  ]);
}

async function upsertTask(
  x: Executor,
  runId: string,
  task: NewTask,
  nowMs: number,
): Promise<void> {
  await x.run(UPSERT_TASK, [
    task.task_id,
    runId,
    task.step_id,
    task.attempt,
    task.activity,
    orNull(task.schema_ref),
    task.queue,
    jsonParam(task.input),
    jsonParam(task.retry),
    task.idempotency_key,
    nowMs,
    task.lease_ttl_ms,
    orNull(task.timeout_ms),
    nowMs,
    nowMs,
  ]);
}

async function applyTaskUpdate(x: Executor, u: TaskUpdate, nowMs: number): Promise<void> {
  if (u.status === "scheduled" || u.status === "retrying") {
    const notBefore = u.not_before_ms ?? nowMs;
    await x.run(RESCHEDULE_TASK, [u.status, u.attempt, notBefore, nowMs, u.task_id]);
    return;
  }
  const sql = TERMINAL_TASK_STATUS.has(u.status) ? CLOSE_TASK : SET_TASK_STATUS;
  await x.run(sql, [u.status, u.attempt, nowMs, u.task_id]);
}

async function insertTimer(x: Executor, runId: string, timer: NewTimer): Promise<void> {
  await x.run(INSERT_TIMER, [runId, timer.step_id, timer.fire_at_ms]);
}

async function insertSignalWait(x: Executor, runId: string, wait: SignalWait): Promise<void> {
  await x.run(INSERT_SIGNAL_WAIT, [
    runId,
    wait.step_id,
    wait.name,
    orNull(wait.schema_ref),
    orNull(wait.expires_at_ms),
  ]);
}

async function updateRun(
  x: Executor,
  runId: string,
  t: Transition,
  opts: ApplyTransitionOptions,
): Promise<void> {
  const status = t.run.status;
  const closed = TERMINAL_RUN_STATUS.has(status);
  const outputRef = opts.outputRef;
  const inlineOutput =
    outputRef === undefined && t.completion?.output !== undefined
      ? jsonParam(t.completion.output)
      : null;
  const params: SqlParam[] = [
    status,
    t.run.last_seq,
    opts.nowMs,
    status === "created" ? null : opts.nowMs,
    inlineOutput,
    orNull(outputRef),
    closed ? opts.nowMs : null,
    orNull(opts.successorRun?.run_id),
    runId,
  ];
  await x.run(UPDATE_RUN, params);
}
