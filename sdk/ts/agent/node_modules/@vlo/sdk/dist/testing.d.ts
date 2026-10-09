import { n as Journal } from "./types-BkQ6NGIA.js";
//#region src/journal/conformance.d.ts
/**
 * Registers the journal conformance suite as a vitest `describe` block named `name`.
 *
 * `open` is called before every case and must return a fresh, empty journal; the suite
 * runs `migrate()` on it and `close()`s it afterwards. The cases check the durability
 * promises the host relies on: gap-free `seq` under concurrent transactions, all-or-nothing
 * transitions, stale-attempt and terminal-task rejection, lease and timeout reaping,
 * once-only timers, schema upserts, signal buffering, run queries and idempotent migration.
 * Call it from a test file, not from application code.
 *
 * @example
 * ```ts
 * import { openJournal } from "@vlo/sdk/host";
 * import { journalConformance } from "@vlo/sdk/testing";
 *
 * let index = 0;
 * journalConformance("sqlite journal", async () =>
 *   openJournal(`sqlite://./.vlo/conformance-${++index}.db`),
 * );
 * ```
 */
export declare function journalConformance(name: string, open: () => Promise<Journal>): void;
//#endregion
//#region src/journal/fixtures.d.ts
/** A clock a test moves by hand; `now` is what a host built with `now: clock.now` sees. */
interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
  /** Moves the clock forward by `ms` milliseconds. Never runs backwards. */
  advance(ms: number): void;
}
/**
 * A {@link Clock} that starts at `startMs` and only moves when `advance` is called, so
 * leases, timers and timeouts expire exactly when a test says so.
 *
 * @example
 * ```ts
 * import { fakeClock } from "@vlo/sdk/testing";
 *
 * const clock = fakeClock(1_700_000_000_000);
 * const host = createHost({
 *   journal: "sqlite://:memory:",
 *   workflows: [workflow],
 *   now: clock.now,
 *   dispatcher: { tickMs: 10 },
 * });
 * await host.start();
 * clock.advance(60_001); // one whole default lease and a millisecond
 * ```
 */
export declare function fakeClock(startMs: number): Clock;
//#endregion
export type { Clock };