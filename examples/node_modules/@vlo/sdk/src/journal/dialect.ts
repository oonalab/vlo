/**
 * The thin seam between the two dialects.
 *
 * All journal SQL is written once, with `?` placeholders; the Postgres executor
 * rewrites them to `$n`. Only two things genuinely differ — how a claimer skips
 * rows another claimer holds, and whether a per-run lock has to be taken
 * explicitly — so both live here.
 */

export type SqlParam = string | number | null;

export type DialectKind = "pg" | "sqlite";

export interface Dialect {
  readonly kind: DialectKind;
  /** Suffix for a claim subquery so concurrent claimers get disjoint sets. */
  readonly skipLocked: string;
}

export const PG: Dialect = { kind: "pg", skipLocked: " FOR UPDATE SKIP LOCKED" };

/** SQLite serialises writers with `BEGIN IMMEDIATE`, so claims never collide. */
export const SQLITE: Dialect = { kind: "sqlite", skipLocked: "" };

/** A connection, or a connection inside a transaction. */
export interface Executor {
  all<R extends object>(sql: string, params?: SqlParam[]): Promise<R[]>;
  /** Returns the number of affected rows. */
  run(sql: string, params?: SqlParam[]): Promise<number>;
  /** Runs a multi-statement script with no parameters. */
  exec(sql: string): Promise<void>;
  /** Holds a named write lock for the rest of the transaction. No-op where the dialect serialises. */
  advisoryLock(key: string): Promise<void>;
}

export async function one<R extends object>(
  x: Executor,
  sql: string,
  params?: SqlParam[],
): Promise<R | null> {
  const rows = await x.all<R>(sql, params);
  return rows[0] ?? null;
}

/** JSON as a bound parameter: one text encoding that both dialects accept. */
export function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function orNull(value: string | number | undefined): SqlParam {
  return value ?? null;
}
