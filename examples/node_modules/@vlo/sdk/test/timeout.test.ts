/**
 * Activity timeouts, from both sides.
 *
 * The worker arms `timeout_ms` itself, which is what normally ends an over-running attempt —
 * including one whose handler ignores `ctx.signal` and keeps going. The host's backstop
 * covers the other case: a worker that never reports at all, which the journal notices only
 * because `dispatched_at_ms + timeout_ms` has passed.
 *
 * Plus the migration that carries the column: 0002 over an existing 0001 database.
 */

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, sequence, step } from "../src/index.ts";
import {
  createClient,
  createHost,
  defineWorker,
  openJournal,
  type Host,
  type TickCounts,
} from "../src/host.ts";
import { MIGRATION_VERSIONS, migrationSql } from "../src/journal/migrations.ts";
import { fakeClock } from "../src/testing.ts";
import { sandbox, sleep, until, type Sandbox } from "./support.ts";

const T0 = 1_700_000_000_000;
const TIMEOUT_MS = 200;

const slow = activity("timeout.slow", {
  input: z.object({ n: z.number() }),
  output: z.object({ ok: z.boolean() }),
  timeoutMs: TIMEOUT_MS,
  // Long lease, so the lease reaper cannot be what ends the attempt.
  leaseMs: 600_000,
  retry: { maxAttempts: 2, initialMs: 0 },
});

const workflow = defineWorkflow("timeout.pipeline", sequence([step(slow)]));

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

async function startHost(
  overrides: Partial<Parameters<typeof createHost>[0]> = {},
): Promise<{ host: Host; box: Sandbox }> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [workflow],
    activities: [slow],
    dispatcher: { tickMs: 10 },
    ...overrides,
  });
  open.push({ host, box });
  await host.start();
  return { host, box };
}

/**
 * A host whose clock never moves, so `dispatched_at_ms + timeout_ms` is never in the past and
 * the backstop provably cannot fire. Whatever ends the attempt in these tests is the worker.
 */
const workerSideOnly = { now: () => T0 } as const;

describe("activity timeouts", () => {
  it("fails an over-running attempt with cause timeout, then succeeds on the retry", async () => {
    const attempts: number[] = [];
    const { host } = await startHost({
      ...workerSideOnly,
      workers: [
        defineWorker({
          [slow.name]: async (_input: { n: number }, ctx) => {
            attempts.push(ctx.attempt);
            ctx.reportUsage({ tokens: 10 });
            // Attempt 1 outlives its budget and ignores `ctx.signal` entirely.
            if (ctx.attempt === 1) await sleep(TIMEOUT_MS * 6);
            return { ok: true };
          },
        }),
      ],
    });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(workflow, { n: 1 });
    const completed = await client.waitFor(started.run_id, "completed", 15_000);
    expect(completed.output).toMatchObject({ "timeout.slow": { ok: true } });
    expect(attempts).toEqual([1, 2]);

    const events = await client.events(started.run_id);
    const retrying = events.find((e) => e.kind === "task" && e.status === "retrying");
    expect(retrying?.cause).toBe("timeout");
    expect(retrying?.attempt).toBe(2);
    expect(retrying?.error).toContain("timed out after");
    // What the abandoned attempt spent still rides along.
    expect(retrying?.usage).toEqual({ cpu_ms: 0, tokens: 10, cost_micro_usd: 0 });

    // The late return from attempt 1 is dropped: exactly one succeeded event, from attempt 2.
    await sleep(TIMEOUT_MS * 6);
    const succeeded = (await client.events(started.run_id)).filter(
      (e) => e.kind === "task" && e.status === "succeeded",
    );
    expect(succeeded.map((e) => e.attempt)).toEqual([2]);
  });

  it("aborts the handler's signal at the deadline", async () => {
    const aborted: boolean[] = [];
    const { host } = await startHost({
      ...workerSideOnly,
      workers: [
        defineWorker({
          [slow.name]: async (_input: { n: number }, ctx) => {
            if (ctx.attempt === 1) {
              await sleep(TIMEOUT_MS * 3);
              aborted.push(ctx.signal.aborted);
            }
            return { ok: true };
          },
        }),
      ],
    });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(workflow, { n: 1 });
    await client.waitFor(started.run_id, "completed", 15_000);
    await until(() => (aborted.length > 0 ? aborted : null));
    expect(aborted).toEqual([true]);
  });

  it("reaps an attempt whose worker never reports, on the host's clock", async () => {
    const clock = fakeClock(T0);
    // No worker at all: the queue is configured pull, so the task is handed out by the poll
    // route and then nobody ever answers for it.
    const { host } = await startHost({
      now: clock.now,
      queues: { default: { mode: "pull" } },
      roles: ["orchestrator", "api"],
      dispatcher: { mode: "manual" },
    });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(workflow, { n: 1 });
    const tick = (): Promise<TickCounts> =>
      host
        .fetch(new Request("http://vlo.localhost/v1/timers/tick", { method: "POST" }))
        .then((response) => response.json() as Promise<TickCounts>);
    await tick();

    // Hand the task out exactly as a pull worker would, then let the worker vanish.
    const handed = await host.fetch(
      new Request("http://vlo.localhost/v1/tasks/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queue: "default", worker_id: "ghost", wait_ms: 0, max: 1 }),
      }),
    );
    const { tasks } = (await handed.json()) as { tasks: { task_id: string; timeout_ms?: number }[] };
    expect(tasks[0]?.timeout_ms).toBe(TIMEOUT_MS);

    // Not yet due: the backstop measures from dispatch, not from the run's start.
    clock.advance(TIMEOUT_MS - 1);
    expect((await tick()).timeouts).toBe(0);

    clock.advance(2);
    expect((await tick()).timeouts).toBe(1);

    const retrying = (await client.events(started.run_id)).find(
      (e) => e.kind === "task" && e.status === "retrying",
    );
    expect(retrying?.cause).toBe("timeout");
    expect(retrying?.error).toContain("without a result");
  });

  it("applies 0002 over a database that only has 0001", async () => {
    const box = await sandbox();
    open.push({ host: { stop: () => Promise.resolve() } as Host, box });

    // A journal as it stood before this change: 0001 applied, and recorded as applied.
    const legacy = new DatabaseSync(box.dbPath);
    legacy.exec(migrationSql("sqlite", "0001_init"));
    legacy
      .prepare("INSERT INTO migrations (version, applied_at_ms) VALUES (?, ?)")
      .run("0001_init", T0);
    const columnsBefore = legacy.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    expect(columnsBefore.map((c) => c.name)).not.toContain("timeout_ms");
    legacy.close();

    const journal = openJournal(box.journalUrl);
    await journal.migrate();
    // Idempotent: the bookkeeping row is what stops SQLite's bare ADD COLUMN running twice.
    await journal.migrate();
    expect(await journal.expiredTimeouts(T0 + 1_000_000, 10)).toEqual([]);
    await journal.close();

    const after = new DatabaseSync(box.dbPath);
    const columns = after.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).toContain("timeout_ms");
    const applied = after.prepare("SELECT version FROM migrations ORDER BY version").all() as {
      version: string;
    }[];
    expect(applied.map((row) => row.version)).toEqual([...MIGRATION_VERSIONS]);
    after.close();
  });
});
