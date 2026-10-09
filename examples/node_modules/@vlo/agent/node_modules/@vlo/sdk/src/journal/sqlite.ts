/**
 * The SQLite journal: one file, one connection, `node:sqlite`.
 *
 * `node:sqlite` is synchronous while the `Journal` API is not, so a promise
 * mutex owns the connection: a transaction holds it from `BEGIN IMMEDIATE`
 * until `COMMIT`, and reads queue behind it. `BEGIN IMMEDIATE` takes SQLite's
 * write lock up front, which is what makes claims disjoint without
 * `SKIP LOCKED`.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import type { Envelope } from "../kernel/protocol.ts";
import { SQLITE, type Executor, type SqlParam } from "./dialect.ts";
import { applyMigrations } from "./migrations.ts";
import * as reads from "./reads.ts";
import { JournalTransaction } from "./tx.ts";
import { JournalClosed } from "./types.ts";
import type {
  Journal,
  JournalTx,
  RunQuery,
  RunRow,
  StateRow,
  TaskRow,
  TimerRow,
} from "./types.ts";

/**
 * `node:sqlite` prints an ExperimentalWarning the moment it is imported, so it is loaded
 * only when a SQLite journal is actually opened; a Postgres host never touches it.
 */
function loadSqlite(): typeof import("node:sqlite") {
  return createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
}

/** Serialises access to the one synchronous connection. */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

class SqliteExecutor implements Executor {
  private readonly statements = new Map<string, StatementSync>();

  constructor(private readonly db: DatabaseSync) {}

  async all<R extends object>(sql: string, params: SqlParam[] = []): Promise<R[]> {
    return this.prepare(sql).all(...params) as R[];
  }

  async run(sql: string, params: SqlParam[] = []): Promise<number> {
    return Number(this.prepare(sql).run(...params).changes);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  /** No-op: `BEGIN IMMEDIATE` already holds the database's single write lock. */
  async advisoryLock(): Promise<void> {}

  private prepare(sql: string): StatementSync {
    const hit = this.statements.get(sql);
    if (hit !== undefined) return hit;
    const statement = this.db.prepare(sql);
    this.statements.set(sql, statement);
    return statement;
  }
}

/** The SQLite {@link Journal}. Opened by `openJournal("sqlite://…")`. */
export class SqliteJournal implements Journal {
  private readonly db: DatabaseSync;
  private readonly executor: SqliteExecutor;
  private readonly mutex = new Mutex();
  /** Every statement in the executor's cache is finalized once the connection closes. */
  private closed = false;

  /** Opens `location` (a path, or `:memory:`) in WAL mode, creating the parent directory. */
  constructor(location: string) {
    // A file journal creates its own directory, so `vlo doctor` and `vlo serve` work on a
    // fresh checkout without the `mkdir .vlo` that `vlo dev` does.
    if (location !== ":memory:") mkdirSync(dirname(location), { recursive: true });
    this.db = new (loadSqlite().DatabaseSync)(location);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.executor = new SqliteExecutor(this.db);
  }

  async migrate(): Promise<void> {
    await this.inTransaction(async () => {
      await applyMigrations(this.executor, "sqlite", () => this.hasMigrationsTable(), Date.now());
    });
  }

  transaction<T>(fn: (tx: JournalTx) => Promise<T>): Promise<T> {
    return this.inTransaction(() => fn(new JournalTransaction(this.executor, SQLITE)));
  }

  readEvents(runId: string, sinceSeq?: number): Promise<Envelope[]> {
    return this.read(() => reads.readEvents(this.executor, runId, sinceSeq));
  }

  getRun(runId: string): Promise<RunRow | null> {
    return this.read(() => reads.getRun(this.executor, runId));
  }

  getState(runId: string): Promise<StateRow | null> {
    return this.read(() => reads.getState(this.executor, runId));
  }

  getTask(taskId: string): Promise<TaskRow | null> {
    return this.read(() => reads.getTask(this.executor, taskId));
  }

  listTasks(runId: string): Promise<TaskRow[]> {
    return this.read(() => reads.listTasks(this.executor, runId));
  }

  query(q: RunQuery): Promise<RunRow[]> {
    return this.read(() => reads.queryRuns(this.executor, q));
  }

  dueTimers(nowMs: number, limit: number): Promise<TimerRow[]> {
    return this.read(() => reads.dueTimers(this.executor, nowMs, limit));
  }

  expiredLeases(nowMs: number, limit: number): Promise<TaskRow[]> {
    return this.read(() => reads.expiredLeases(this.executor, nowMs, limit));
  }

  expiredTimeouts(nowMs: number, limit: number): Promise<TaskRow[]> {
    return this.read(() => reads.expiredTimeouts(this.executor, nowMs, limit));
  }

  /** Idempotent. Work queued before it still runs; anything after gets `JournalClosed`. */
  async close(): Promise<void> {
    await this.mutex.run(async () => {
      if (this.closed) return;
      this.closed = true;
      this.db.close();
    });
  }

  private read<T>(fn: () => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      this.assertOpen();
      return fn();
    });
  }

  private inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      this.assertOpen();
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn();
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
          // The transaction was already rolled back by SQLite.
        }
        throw error;
      }
    });
  }

  private assertOpen(): void {
    if (this.closed) throw new JournalClosed("sqlite");
  }

  private async hasMigrationsTable(): Promise<boolean> {
    const rows = await this.executor.all(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'",
    );
    return rows.length > 0;
  }
}
