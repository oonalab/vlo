/**
 * The Postgres journal.
 *
 * Every statement runs inside a transaction whose `search_path` is pinned with
 * `SET LOCAL` to the journal's own schema (`vlo` by default, or a throwaway schema in
 * tests), so the shared SQL can name tables unqualified and nothing can reach `public`.
 * Nothing is session state: no startup `options`, no session-level `SET`, no
 * session-level advisory locks — so the journal works behind transaction-mode poolers
 * (PgBouncer, PlanetScale, Neon), which reject startup parameters and multiplex
 * sessions. Per-run serialisation is a transaction-scoped advisory lock; claims use
 * `FOR UPDATE SKIP LOCKED`.
 */

import pg from "pg";
import type { Envelope } from "../kernel/protocol.ts";
import { PG, type Executor, type SqlParam } from "./dialect.ts";
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

const { Pool } = pg;

const MIGRATE_LOCK = "vlo:migrate";
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface PostgresJournalOptions {
  /** Schema that owns every journal table. Default `vlo`. */
  schema?: string;
  /** Maximum pooled connections. */
  max?: number;
}

interface Queryable {
  query(
    text: string,
    values?: SqlParam[],
  ): Promise<{ rows: unknown[]; rowCount: number | null }>;
}

const rewritten = new Map<string, string>();

/** Shared SQL is written with `?`; Postgres wants `$n`. */
function toPgSql(sql: string): string {
  const hit = rewritten.get(sql);
  if (hit !== undefined) return hit;
  let index = 0;
  const out = sql.replace(/\?/g, () => `$${++index}`);
  rewritten.set(sql, out);
  return out;
}

class PgExecutor implements Executor {
  constructor(private readonly q: Queryable) {}

  async all<R extends object>(sql: string, params: SqlParam[] = []): Promise<R[]> {
    const result = await this.q.query(toPgSql(sql), params);
    return result.rows as R[];
  }

  async run(sql: string, params: SqlParam[] = []): Promise<number> {
    const result = await this.q.query(toPgSql(sql), params);
    return result.rowCount ?? 0;
  }

  async exec(sql: string): Promise<void> {
    await this.q.query(sql);
  }

  async advisoryLock(key: string): Promise<void> {
    await this.q.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
  }
}

/** The Postgres {@link Journal}. Opened by `openJournal("postgres://…")`. */
export class PostgresJournal implements Journal {
  private readonly pool: pg.Pool;
  private readonly schema: string;
  private readonly executor: PgExecutor;
  private closed = false;

  /** Creates the pool; no connection is made until the first call. Throws on a schema name that is not a plain identifier. */
  constructor(url: string, opts: PostgresJournalOptions = {}) {
    this.schema = assertIdentifier(opts.schema ?? "vlo");
    this.pool = new Pool({
      connectionString: url,
      ...(opts.max !== undefined ? { max: opts.max } : {}),
    });
    // A read is a one-statement transaction with the schema pinned, behind the same closed
    // check the transactions take, so a late call after `close()` fails as `JournalClosed`.
    this.executor = new PgExecutor({
      query: (text, values) => this.inPinnedTransaction((client) => client.query(text, values)),
    });
  }

  /** Runs `fn` on one connection inside `BEGIN … COMMIT` with `search_path` set locally. */
  private async inPinnedTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    this.assertOpen();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${this.schema}`);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async migrate(): Promise<void> {
    this.assertOpen();
    const client = await this.pool.connect();
    try {
      // The schema has to exist and be committed before `search_path` can resolve to it.
      // `CREATE SCHEMA IF NOT EXISTS` needs CREATE on the database even when the schema is
      // already there, so a schema a DBA provisioned for a role without that privilege is
      // detected first and left alone.
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [MIGRATE_LOCK]);
      const present = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [this.schema]);
      if (present.rowCount === 0) await client.query(`CREATE SCHEMA ${this.schema}`);
      await client.query("COMMIT");

      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [MIGRATE_LOCK]);
      await client.query(`SET LOCAL search_path TO ${this.schema}`);
      const executor = new PgExecutor(client);
      await applyMigrations(executor, "pg", () => this.hasMigrationsTable(executor), Date.now());
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  transaction<T>(fn: (tx: JournalTx) => Promise<T>): Promise<T> {
    return this.inPinnedTransaction((client) =>
      fn(new JournalTransaction(new PgExecutor(client), PG)),
    );
  }

  readEvents(runId: string, sinceSeq?: number): Promise<Envelope[]> {
    return reads.readEvents(this.executor, runId, sinceSeq);
  }

  getRun(runId: string): Promise<RunRow | null> {
    return reads.getRun(this.executor, runId);
  }

  getState(runId: string): Promise<StateRow | null> {
    return reads.getState(this.executor, runId);
  }

  getTask(taskId: string): Promise<TaskRow | null> {
    return reads.getTask(this.executor, taskId);
  }

  listTasks(runId: string): Promise<TaskRow[]> {
    return reads.listTasks(this.executor, runId);
  }

  query(q: RunQuery): Promise<RunRow[]> {
    return reads.queryRuns(this.executor, q);
  }

  dueTimers(nowMs: number, limit: number): Promise<TimerRow[]> {
    return reads.dueTimers(this.executor, nowMs, limit);
  }

  expiredLeases(nowMs: number, limit: number): Promise<TaskRow[]> {
    return reads.expiredLeases(this.executor, nowMs, limit);
  }

  expiredTimeouts(nowMs: number, limit: number): Promise<TaskRow[]> {
    return reads.expiredTimeouts(this.executor, nowMs, limit);
  }

  /** Idempotent. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }

  private assertOpen(): void {
    if (this.closed) throw new JournalClosed("postgres");
  }

  private async hasMigrationsTable(x: Executor): Promise<boolean> {
    const rows = await x.all<{ present: boolean }>(
      "SELECT to_regclass(CAST(? AS text)) IS NOT NULL AS present",
      [`${this.schema}.migrations`],
    );
    return rows[0]?.present === true;
  }
}

function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`invalid journal schema name: ${name}`);
  return name;
}
