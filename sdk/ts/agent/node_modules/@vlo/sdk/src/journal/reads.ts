/**
 * Read-only queries, shared by the `Journal` (pooled connection) and by
 * `JournalTx` (inside a transaction).
 */

import type { Envelope } from "../kernel/protocol.ts";
import { one, type Executor, type SqlParam } from "./dialect.ts";
import {
  mapEvent,
  mapRun,
  mapState,
  mapTask,
  mapTimer,
  type Raw,
} from "./rows.ts";
import type { RunQuery, RunRow, StateRow, TaskRow, TimerRow } from "./types.ts";

const RUN_COLUMNS = "*";
const DEFAULT_QUERY_LIMIT = 100;

export async function readEvents(
  x: Executor,
  runId: string,
  sinceSeq = 0,
): Promise<Envelope[]> {
  const rows = await x.all<Raw>(
    "SELECT * FROM events WHERE run_id = ? AND seq > ? ORDER BY seq",
    [runId, sinceSeq],
  );
  return rows.map(mapEvent);
}

export async function getRun(x: Executor, runId: string): Promise<RunRow | null> {
  const row = await one<Raw>(x, `SELECT ${RUN_COLUMNS} FROM runs WHERE run_id = ?`, [runId]);
  return row ? mapRun(row) : null;
}

export async function getState(x: Executor, runId: string): Promise<StateRow | null> {
  const row = await one<Raw>(x, "SELECT * FROM run_state WHERE run_id = ?", [runId]);
  return row ? mapState(row) : null;
}

export async function getTask(x: Executor, taskId: string): Promise<TaskRow | null> {
  const row = await one<Raw>(x, "SELECT * FROM tasks WHERE task_id = ?", [taskId]);
  return row ? mapTask(row) : null;
}

export async function listTasks(x: Executor, runId: string): Promise<TaskRow[]> {
  const rows = await x.all<Raw>(
    "SELECT * FROM tasks WHERE run_id = ? ORDER BY created_at_ms, task_id",
    [runId],
  );
  return rows.map(mapTask);
}

export async function queryRuns(x: Executor, q: RunQuery): Promise<RunRow[]> {
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (q.namespace !== undefined) {
    where.push("namespace = ?");
    params.push(q.namespace);
  }
  if (q.status !== undefined) {
    where.push("status = ?");
    params.push(q.status);
  }
  if (q.workflow !== undefined) {
    where.push("workflow = ?");
    params.push(q.workflow);
  }
  params.push(q.limit ?? DEFAULT_QUERY_LIMIT);
  const filter = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await x.all<Raw>(
    `SELECT ${RUN_COLUMNS} FROM runs ${filter} ORDER BY created_at_ms DESC, run_id DESC LIMIT ?`,
    params,
  );
  return rows.map(mapRun);
}

export async function dueTimers(
  x: Executor,
  nowMs: number,
  limit: number,
): Promise<TimerRow[]> {
  const rows = await x.all<Raw>(
    `SELECT * FROM timers
       WHERE fired_at_ms IS NULL AND fire_at_ms <= ?
       ORDER BY fire_at_ms, run_id, step_id
       LIMIT ?`,
    [nowMs, limit],
  );
  return rows.map(mapTimer);
}

export async function expiredLeases(
  x: Executor,
  nowMs: number,
  limit: number,
): Promise<TaskRow[]> {
  const rows = await x.all<Raw>(
    `SELECT * FROM tasks
       WHERE status = 'running' AND lease_until_ms IS NOT NULL AND lease_until_ms < ?
       ORDER BY lease_until_ms, task_id
       LIMIT ?`,
    [nowMs, limit],
  );
  return rows.map(mapTask);
}

/**
 * Running attempts whose wall-clock budget has run out. A task dispatched but not yet
 * stamped has a NULL `dispatched_at_ms`, and NULL + timeout is NULL, so it is never due.
 */
export async function expiredTimeouts(
  x: Executor,
  nowMs: number,
  limit: number,
): Promise<TaskRow[]> {
  const rows = await x.all<Raw>(
    `SELECT * FROM tasks
       WHERE status = 'running'
         AND timeout_ms IS NOT NULL
         AND dispatched_at_ms + timeout_ms < ?
       ORDER BY dispatched_at_ms, task_id
       LIMIT ?`,
    [nowMs, limit],
  );
  return rows.map(mapTask);
}
