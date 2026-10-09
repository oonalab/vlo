/** Journal selection by URL scheme. */

import { PostgresJournal, type PostgresJournalOptions } from "./postgres.ts";
import { SqliteJournal } from "./sqlite.ts";
import type { Journal } from "./types.ts";

/** Options for {@link openJournal}. Only the Postgres journal reads any. */
export type JournalOptions = PostgresJournalOptions;

const SQLITE_PREFIX = "sqlite://";

/**
 * Opens a journal by URL: `sqlite://:memory:`, `sqlite://./.vlo/dev.db`,
 * `sqlite:///abs/path.db`, `postgres://…` or `postgresql://…`. Nothing is created or
 * migrated until `migrate()`. Throws a plain `Error` on any other scheme.
 *
 * @example
 * ```ts
 * import { openJournal } from "@vlo/sdk/host";
 *
 * const journal = openJournal("postgres://user:pass@localhost/app", { schema: "vlo", max: 5 });
 * await journal.migrate();
 * const run = await journal.getRun("run_1");
 * await journal.close();
 * ```
 */
export function openJournal(url: string, opts: JournalOptions = {}): Journal {
  if (url.startsWith(SQLITE_PREFIX)) return new SqliteJournal(sqliteLocation(url));
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return new PostgresJournal(url, opts);
  }
  throw new Error(`unsupported journal url: ${url}`);
}

function sqliteLocation(url: string): string {
  const location = url.slice(SQLITE_PREFIX.length);
  if (location.length === 0) throw new Error(`sqlite journal url has no path: ${url}`);
  return location;
}
