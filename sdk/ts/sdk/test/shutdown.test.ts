/**
 * Stopping a host that is still busy.
 *
 * Shutdown races everything: a dispatcher pass mid-claim, a worker about to report. The
 * contract is that `stop()` waits for what it can and that whatever lands afterwards meets
 * one recognisable `JournalClosed` — not `node:sqlite`'s finalized-statement `ERR_INVALID_STATE`,
 * which crashed the suite as an unhandled rejection rather than as "the host is stopping".
 */

import { afterEach, describe, expect, it } from "vitest";
import { defineWorkflow, sequence, step } from "../src/index.ts";
import { createClient, createHost, defineWorker, openJournal, type Host } from "../src/host.ts";
import { JournalClosed } from "../src/host.ts";
import { plan } from "./example/activities.ts";
import { sandbox, sleep, until, type Sandbox } from "./support.ts";

const oneStep = defineWorkflow("shutdown.oneStep", sequence([step(plan)]));

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

/** A host whose only handler is slower than the stop that interrupts it. */
async function busyHost(workMs: number): Promise<Host> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [oneStep],
    activities: [plan],
    workers: [
      defineWorker({
        "example.plan": async () => {
          await sleep(workMs);
          return { items: ["item-0"] };
        },
      }),
    ],
    dispatcher: { tickMs: 5 },
  });
  open.push({ host, box });
  await host.start();
  return host;
}

/** Collects unhandled rejections for the duration of `body`. */
async function withRejectionSpy(body: () => Promise<void>): Promise<unknown[]> {
  const seen: unknown[] = [];
  const onRejection = (error: unknown): void => {
    seen.push(error);
  };
  process.on("unhandledRejection", onRejection);
  try {
    await body();
    // Late reports land a tick or two after the stop; give them the chance to be unhandled.
    await sleep(200);
  } finally {
    process.off("unhandledRejection", onRejection);
  }
  return seen;
}

describe("shutdown", () => {
  it("stops while a task is running, with no unhandled rejection", async () => {
    const host = await busyHost(150);
    const client = createClient({ fetch: host.fetch });
    const started = await client.start(oneStep, { n: 1 });
    await until(async () => ((await client.get(started.run_id)).status === "running" ? true : null));

    const rejections = await withRejectionSpy(async () => {
      await host.stop();
    });

    expect(rejections).toEqual([]);
  });

  it("drops a journal that closed under a running dispatcher instead of warning", async () => {
    const host = await busyHost(20);
    const warnings: unknown[] = [];
    host.events.on("warning", (warning) => warnings.push(warning));
    const client = createClient({ fetch: host.fetch });
    await client.start(oneStep, { n: 1 });

    const rejections = await withRejectionSpy(async () => {
      // The journal goes while the loop dispatcher is mid-flight — the crash-shaped case.
      await host.journal.close();
    });

    expect(rejections).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("answers every call after close with JournalClosed, and closes idempotently", async () => {
    const box = await sandbox();
    const journal = openJournal(box.journalUrl);
    await journal.migrate();
    await journal.close();
    await journal.close();

    await expect(journal.getRun("run_1")).rejects.toBeInstanceOf(JournalClosed);
    await expect(journal.transaction((tx) => tx.lockRun("run_1"))).rejects.toBeInstanceOf(
      JournalClosed,
    );
    await box.cleanup();
  });
});
