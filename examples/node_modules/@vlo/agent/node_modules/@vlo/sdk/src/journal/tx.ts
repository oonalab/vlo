/**
 * One transaction's worth of journal operations, written once for both dialects.
 *
 * The only dialect-dependent pieces are injected: `Executor` runs the SQL and
 * `Dialect.skipLocked` makes concurrent claimers disjoint on Postgres (SQLite
 * gets that from `BEGIN IMMEDIATE`).
 */

import type { Envelope, Transition } from "../kernel/protocol.ts";
import { applyTransition, insertRun } from "./apply.ts";
import { one, orNull, type Dialect, type Executor, type SqlParam } from "./dialect.ts";
import * as reads from "./reads.ts";
import { mapRun, mapSchema, mapSignal, mapSignalWait, mapTask, mapTimer, type Raw } from "./rows.ts";
import type {
  ApplyTransitionOptions,
  JournalTx,
  NewRunRow,
  NewSignalRow,
  RunRow,
  SchemaRow,
  SignalRow,
  SignalWaitRow,
  StateRow,
  TaskClaimFilter,
  TaskRow,
  TimerRow,
} from "./types.ts";

const RUN_LOCK_PREFIX = "vlo:run:";

export class JournalTransaction implements JournalTx {
  constructor(
    private readonly x: Executor,
    private readonly d: Dialect,
  ) {}

  async lockRun(runId: string): Promise<RunRow | null> {
    await this.x.advisoryLock(RUN_LOCK_PREFIX + runId);
    return reads.getRun(this.x, runId);
  }

  async createRun(row: NewRunRow, nowMs: number): Promise<void> {
    await insertRun(this.x, row, nowMs);
  }

  getState(runId: string): Promise<StateRow | null> {
    return reads.getState(this.x, runId);
  }

  readEvents(runId: string, sinceSeq?: number): Promise<Envelope[]> {
    return reads.readEvents(this.x, runId, sinceSeq);
  }

  applyTransition(runId: string, t: Transition, opts: ApplyTransitionOptions): Promise<void> {
    return applyTransition(this.x, runId, t, opts);
  }

  async claimUndispatchedTasks(
    nowMs: number,
    limit: number,
    holdMs: number,
    filter?: TaskClaimFilter,
  ): Promise<TaskRow[]> {
    // The filter clauses sit between the fixed predicates and the LIMIT, so the bound
    // parameters stay in the same order as the `?`s the dialect rewrites.
    const clauses: string[] = [];
    const params: SqlParam[] = [nowMs + holdMs, nowMs, nowMs, nowMs];
    if (filter?.queue !== undefined) {
      clauses.push("AND queue = ?");
      params.push(filter.queue);
    }
    const excluded = filter?.excludeQueues ?? [];
    if (excluded.length > 0) {
      clauses.push(`AND queue NOT IN (${excluded.map(() => "?").join(", ")})`);
      params.push(...excluded);
    }
    params.push(limit);

    const rows = await this.x.all<Raw>(
      `UPDATE tasks SET
         dispatch_claimed_until_ms = ?,
         dispatch_attempts = dispatch_attempts + 1,
         updated_at_ms = ?
       WHERE task_id IN (
         SELECT task_id FROM tasks
          WHERE status = 'scheduled'
            AND dispatched_at_ms IS NULL
            AND not_before_ms <= ?
            AND (dispatch_claimed_until_ms IS NULL OR dispatch_claimed_until_ms < ?)
            ${clauses.join("\n            ")}
          ORDER BY not_before_ms, created_at_ms, task_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`,
      params,
    );
    return rows.map(mapTask);
  }

  async markDispatched(
    taskId: string,
    attempt: number,
    nowMs: number,
    leaseUntilMs: number,
    workerId?: string,
  ): Promise<boolean> {
    const changed = await this.x.run(
      `UPDATE tasks SET
         status = 'running',
         dispatched_at_ms = ?,
         lease_until_ms = ?,
         heartbeat_at_ms = ?,
         worker_id = ?,
         dispatch_claimed_until_ms = NULL,
         updated_at_ms = ?
       WHERE task_id = ? AND attempt = ?
         AND (status = 'scheduled' OR (status = 'running' AND dispatched_at_ms IS NULL))`,
      [nowMs, leaseUntilMs, nowMs, orNull(workerId), nowMs, taskId, attempt],
    );
    return changed > 0;
  }

  async deferDispatch(taskId: string, attempt: number, notBeforeMs: number): Promise<void> {
    await this.x.run(
      `UPDATE tasks SET not_before_ms = ?, dispatch_claimed_until_ms = NULL
       WHERE task_id = ? AND attempt = ?`,
      [notBeforeMs, taskId, attempt],
    );
  }

  async heartbeat(
    taskId: string,
    attempt: number,
    leaseUntilMs: number,
    nowMs: number,
  ): Promise<boolean> {
    const changed = await this.x.run(
      `UPDATE tasks SET lease_until_ms = ?, heartbeat_at_ms = ?, updated_at_ms = ?
       WHERE task_id = ? AND attempt = ? AND status = 'running'`,
      [leaseUntilMs, nowMs, nowMs, taskId, attempt],
    );
    return changed > 0;
  }

  async claimCreatedRuns(nowMs: number, limit: number, holdMs: number): Promise<RunRow[]> {
    const rows = await this.x.all<Raw>(
      `UPDATE runs SET start_claimed_until_ms = ?, updated_at_ms = ?
       WHERE run_id IN (
         SELECT run_id FROM runs
          WHERE status = 'created'
            AND (start_claimed_until_ms IS NULL OR start_claimed_until_ms < ?)
          ORDER BY created_at_ms, run_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`,
      [nowMs + holdMs, nowMs, nowMs, limit],
    );
    return rows.map(mapRun);
  }

  async claimClosedUnnotified(nowMs: number, limit: number, holdMs: number): Promise<RunRow[]> {
    const rows = await this.x.all<Raw>(
      `UPDATE runs SET notify_claimed_until_ms = ?, updated_at_ms = ?
       WHERE run_id IN (
         SELECT run_id FROM runs
          WHERE parent_run_id IS NOT NULL
            AND parent_notified_at_ms IS NULL
            AND closed_at_ms IS NOT NULL
            AND (notify_claimed_until_ms IS NULL OR notify_claimed_until_ms < ?)
          ORDER BY closed_at_ms, run_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`,
      [nowMs + holdMs, nowMs, nowMs, limit],
    );
    return rows.map(mapRun);
  }

  async markParentNotified(runId: string, nowMs: number): Promise<void> {
    await this.x.run(
      `UPDATE runs SET parent_notified_at_ms = ?, updated_at_ms = ?
       WHERE run_id = ? AND parent_notified_at_ms IS NULL`,
      [nowMs, nowMs, runId],
    );
  }

  async claimDueTimers(nowMs: number, limit: number, holdMs: number): Promise<TimerRow[]> {
    const rows = await this.x.all<Raw>(
      `UPDATE timers SET claimed_until_ms = ?
       WHERE (run_id, step_id) IN (
         SELECT run_id, step_id FROM timers
          WHERE fired_at_ms IS NULL
            AND fire_at_ms <= ?
            AND (claimed_until_ms IS NULL OR claimed_until_ms < ?)
          ORDER BY fire_at_ms, run_id, step_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`,
      [nowMs + holdMs, nowMs, nowMs, limit],
    );
    return rows.map(mapTimer);
  }

  async markTimerFired(runId: string, stepId: string, nowMs: number): Promise<boolean> {
    const changed = await this.x.run(
      "UPDATE timers SET fired_at_ms = ? WHERE run_id = ? AND step_id = ? AND fired_at_ms IS NULL",
      [nowMs, runId, stepId],
    );
    return changed > 0;
  }

  async putSignal(row: NewSignalRow, nowMs: number): Promise<void> {
    await this.x.run(
      `INSERT INTO signals (signal_id, run_id, name, payload, payload_ref, sender, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (signal_id) DO NOTHING`,
      [
        row.signal_id,
        row.run_id,
        row.name,
        orNull(row.payload),
        orNull(row.payload_ref),
        orNull(row.sender),
        nowMs,
      ],
    );
  }

  async takeSignal(runId: string, name: string): Promise<SignalRow | null> {
    const row = await one<Raw>(
      this.x,
      `SELECT * FROM signals
        WHERE run_id = ? AND name = ? AND delivered_at_ms IS NULL
        ORDER BY created_at_ms, signal_id
        LIMIT 1${this.d.skipLocked}`,
      [runId, name],
    );
    return row ? mapSignal(row) : null;
  }

  async markSignalDelivered(signalId: string, stepId: string, nowMs: number): Promise<void> {
    await this.x.run(
      `UPDATE signals SET delivered_at_ms = ?, delivered_step_id = ?
       WHERE signal_id = ? AND delivered_at_ms IS NULL`,
      [nowMs, stepId, signalId],
    );
  }

  async getSignalWaits(runId: string): Promise<SignalWaitRow[]> {
    const rows = await this.x.all<Raw>(
      "SELECT * FROM signal_waits WHERE run_id = ? ORDER BY step_id",
      [runId],
    );
    return rows.map(mapSignalWait);
  }

  async removeSignalWait(runId: string, stepId: string): Promise<void> {
    await this.x.run("DELETE FROM signal_waits WHERE run_id = ? AND step_id = ?", [runId, stepId]);
  }

  async upsertSchema(row: SchemaRow, nowMs: number): Promise<void> {
    await this.x.run(
      `INSERT INTO schemas (name, version, json_schema, retry_policy, created_at_ms)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (name, version) DO UPDATE SET
         json_schema = excluded.json_schema,
         retry_policy = excluded.retry_policy`,
      [row.name, row.version, row.json_schema, orNull(row.retry_policy), nowMs],
    );
  }

  async getSchema(name: string, version: string): Promise<SchemaRow | null> {
    const row = await one<Raw>(
      this.x,
      "SELECT * FROM schemas WHERE name = ? AND version = ?",
      [name, version],
    );
    return row ? mapSchema(row) : null;
  }
}
