/**
 * Timers. A `sleep` phase parks the run on a durable row; nothing in the process holds it.
 * The dispatcher's timers stage is what wakes it, and it wakes it exactly once — even when
 * two orchestrators share the journal and claim the same due timer.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cmd, defineWorkflow, sequence, sleep, step } from "../src/index.ts";
import { createClient, createHost, openJournal, type Host, type Journal } from "../src/host.ts";
import { approve, finish, plan } from "./example/activities.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, until, type Sandbox } from "./support.ts";

const SLEEP_MS = 150;
const WAIT_TIMEOUT_MS = 50;

/** Parks on `approve` with a deadline; whichever of the signal and the timer lands first wins. */
const deadline = defineWorkflow("timers.deadline", {
  init: () => ({}),
  on: {
    started: (state) => [
      state,
      [cmd.awaitSignal(approve, { id: "wait", timeoutMs: WAIT_TIMEOUT_MS })],
    ],
    task_done: (state) => [state, []],
    timer: (state, event) =>
      event.step_id === "wait:timeout" ? [state, [cmd.complete("timed_out")]] : [state, []],
    signal: (state, event) => [state, [cmd.complete(event.payload)]],
  },
});

const napping = defineWorkflow(
  "timers.napping",
  sequence([
    step(plan),
    sleep(SLEEP_MS),
    step(finish, (state) => ({
      uppers: (state.results["example.plan"] as { items: string[] }).items.map((item) =>
        item.toUpperCase(),
      ),
      approvedBy: "the clock",
    })),
  ]),
);

const open: { host?: Host; box?: Sandbox; journal?: Journal }[] = [];

afterEach(async () => {
  const entries = open.splice(0).reverse();
  for (const entry of entries) await entry.host?.stop();
  for (const entry of entries) await entry.journal?.close();
  for (const entry of entries) await entry.box?.cleanup();
});

type Options = Parameters<typeof createHost>[0];

function baseOptions(box: Sandbox): Omit<Options, "journal"> {
  return {
    blob: box.blobUrl,
    workflows: [napping, deadline],
    activities: [plan, finish],
    workers: [exampleWorker({ workMs: 1 }).worker],
    dispatcher: { tickMs: 20 },
  };
}

async function start(box: Sandbox, options: Partial<Options> = {}): Promise<Host> {
  const host = createHost({ ...baseOptions(box), journal: box.journalUrl, ...options });
  open.push({ host, box });
  await host.start();
  return host;
}

describe("timers", () => {
  it("parks on a sleep, then fires it once and finishes", async () => {
    const box = await sandbox();
    const host = await start(box);
    const client = createClient({ fetch: host.fetch });

    const at = Date.now();
    const started = await client.start(napping, { n: 2 });
    const completed = await client.waitFor(started.run_id, "completed");

    expect(Date.now() - at).toBeGreaterThanOrEqual(SLEEP_MS);
    expect(completed.output).toMatchObject({
      "example.finish": { report: "ITEM-0,ITEM-1 approved by the clock" },
    });

    const fired = (await client.events(started.run_id)).filter(
      (event) => event.kind === "timer" && event.status === "succeeded",
    );
    expect(fired).toHaveLength(1);
    expect(fired[0]?.step_id).toBe("sleep#1");
  });

  it("fires a timer once when two orchestrators share one journal", async () => {
    const box = await sandbox();
    // One SQLite file, two hosts. They share the `Journal` object rather than opening the
    // file twice: `node:sqlite` blocks synchronously on a busy database, so two connections
    // inside one process would deadlock each other — a test-harness limit, not a host one.
    const journal = openJournal(box.journalUrl);
    // No claim hold, so both orchestrators claim the same due timer on the same tick and
    // `markTimerFired` — not the claim — is what keeps the run from seeing two timer events.
    const racing = { journal, dispatcher: { tickMs: 20, claimHoldMs: 0 } };
    const first = await start(box, racing);
    await start(box, racing);
    open.push({ journal });

    const client = createClient({ fetch: first.fetch });
    const started = await client.start(napping, { n: 1 });
    await client.waitFor(started.run_id, "completed");

    const events = await client.events(started.run_id);
    const fired = events.filter((event) => event.kind === "timer" && event.status === "succeeded");
    expect(fired).toHaveLength(1);
  });

  it("signal wait times out through the dispatcher", async () => {
    const box = await sandbox();
    const host = await start(box);
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(deadline, null);
    const completed = await client.waitFor(started.run_id, "completed");
    expect(completed.output).toBe("timed_out");

    const fired = (await client.events(started.run_id)).filter(
      (event) => event.kind === "timer" && event.status === "succeeded",
    );
    expect(fired).toHaveLength(1);
    expect(fired[0]?.step_id).toBe("wait:timeout");

    // The wait's step is gone, so a late signal is not a 409: it is recorded, not delivered,
    // and the stale wait row goes with it.
    const late = await client.signal(started.run_id, approve, { by: "late" });
    expect(late.delivered).toBe(false);
    const waits = await host.journal.transaction((tx) => tx.getSignalWaits(started.run_id));
    expect(waits).toHaveLength(0);
    const delivered = (await client.events(started.run_id)).filter(
      (event) => event.kind === "signal" && event.status === "succeeded",
    );
    expect(delivered).toHaveLength(0);
  });

  it("signal arrives first", async () => {
    const box = await sandbox();
    const host = await start(box);
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(deadline, null);
    // Sent before the wait opens, so it is buffered and folded the moment `started` opens the
    // wait — well inside the deadline, whatever the dispatcher's timing.
    await client.signal(started.run_id, approve, { by: "dc" });
    const completed = await client.waitFor(started.run_id, "completed");
    expect(completed.output).toEqual({ by: "dc" });

    // The timer step was opened, then pruned when the signal won: its row is retired by the
    // fire-timers stage once due, and no `timer` event is ever journaled.
    const farFuture = Date.now() + WAIT_TIMEOUT_MS + 60_000;
    await until(async () => {
      const due = await host.journal.dueTimers(farFuture, 100);
      return due.some((timer) => timer.run_id === started.run_id) ? null : true;
    });
    const timers = (await client.events(started.run_id)).filter((event) => event.kind === "timer");
    expect(timers.map((event) => event.status)).toEqual(["scheduled"]);
    expect(timers[0]?.step_id).toBe("wait:timeout");
  });
});
