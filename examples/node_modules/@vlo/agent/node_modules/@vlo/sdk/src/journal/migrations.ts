/**
 * The migration runner.
 *
 * Migrations are SQL strings, one module per dialect and version (inlined so the SDK
 * bundles without runtime file reads), applied in `MIGRATION_VERSIONS` order inside the
 * caller's transaction and recorded in `migrations`; the caller holds a lock so two
 * processes cannot interleave. Statements are `IF NOT EXISTS` wherever the dialect allows
 * it, so re-running is a no-op even if the bookkeeping row is missing — the exception is
 * SQLite's `ADD COLUMN`, which is guarded only by the `migrations` row.
 */

import type { DialectKind, Executor } from "./dialect.ts";
import { sql as pgInit } from "./migrations/pg/0001_init.ts";
import { sql as pgTaskTimeout } from "./migrations/pg/0002_task_timeout.ts";
import { sql as pgContinuedTo } from "./migrations/pg/0003_continued_to.ts";
import { sql as sqliteInit } from "./migrations/sqlite/0001_init.ts";
import { sql as sqliteTaskTimeout } from "./migrations/sqlite/0002_task_timeout.ts";
import { sql as sqliteContinuedTo } from "./migrations/sqlite/0003_continued_to.ts";

export const MIGRATION_VERSIONS = ["0001_init", "0002_task_timeout", "0003_continued_to"] as const;
type MigrationVersion = (typeof MIGRATION_VERSIONS)[number];

const MIGRATIONS: Record<DialectKind, Record<MigrationVersion, string>> = {
  pg: {
    "0001_init": pgInit,
    "0002_task_timeout": pgTaskTimeout,
    "0003_continued_to": pgContinuedTo,
  },
  sqlite: {
    "0001_init": sqliteInit,
    "0002_task_timeout": sqliteTaskTimeout,
    "0003_continued_to": sqliteContinuedTo,
  },
};

export function migrationSql(kind: DialectKind, version: MigrationVersion): string {
  return MIGRATIONS[kind][version];
}

/**
 * @param hasMigrationsTable dialect-specific probe, so the runner needs no
 *   bootstrap copy of the `migrations` DDL.
 */
export async function applyMigrations(
  x: Executor,
  kind: DialectKind,
  hasMigrationsTable: () => Promise<boolean>,
  nowMs: number,
): Promise<void> {
  const applied = (await hasMigrationsTable()) ? await appliedVersions(x) : new Set<string>();
  for (const version of MIGRATION_VERSIONS) {
    if (applied.has(version)) continue;
    await x.exec(migrationSql(kind, version));
    await x.run(
      "INSERT INTO migrations (version, applied_at_ms) VALUES (?, ?) ON CONFLICT (version) DO NOTHING",
      [version, nowMs],
    );
  }
}

async function appliedVersions(x: Executor): Promise<Set<string>> {
  const rows = await x.all<{ version: string }>("SELECT version FROM migrations");
  return new Set(rows.map((r) => r.version));
}
