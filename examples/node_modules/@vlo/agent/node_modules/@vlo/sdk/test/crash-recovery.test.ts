/**
 * What the outbox is for.
 *
 * (a) Nothing is lost between "row written" and "effect happened": a host with no
 *     orchestrator accepts runs, and a host that joins later starts and finishes them.
 * (b) A dispatch that is pushed but never recorded is pushed again, and the worker's
 *     idempotency key — not the host — is what keeps the activity from running twice.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createClient, createHost, type Host } from "../src/host.ts";
import type { Journal, JournalTx } from "../src/host.ts";
import { openJournal } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, until, type Sandbox } from "./support.ts";

const hosts: Host[] = [];
const boxes: Sandbox[] = [];

afterEach(async () => {
  for (const host of hosts.splice(0).reverse()) await host.stop();
  for (const box of boxes.splice(0)) await box.cleanup();
});

type Options = Parameters<typeof createHost>[0];

async function start(options: Options): Promise<Host> {
  const host = createHost(options);
  hosts.push(host);
  await host.start();
  return host;
}

function baseOptions(box: Sandbox): Omit<Options, "journal"> {
  return {
    blob: box.blobUrl,
    workflows: [exampleWorkflow],
    activities: [plan, work, finish],
    signals: [approve],
    dispatcher: { tickMs: 20 },
  };
}

describe("crash recovery", () => {
  it("hands an unstarted run to whichever host has the orchestrator role", async () => {
    const box = await sandbox();
    boxes.push(box);

    // Phase 1 — api only: the run row is written, nothing runs.
    const api = await start({ ...baseOptions(box), journal: box.journalUrl, roles: ["api"] });
    const client = createClient({ fetch: api.fetch });
    const started = await client.start(exampleWorkflow, { n: 1 });
    expect(started.status).toBe("created");
    expect(await api.journal.listTasks(started.run_id)).toHaveLength(0);
    await api.stop();

    // Phase 2 — an orchestrator with no worker: the run starts, the task waits undispatched.
    const orchestrator = await start({
      ...baseOptions(box),
      journal: box.journalUrl,
      roles: ["orchestrator"],
      dispatcher: { tickMs: 20, unroutableBackoffMs: 0 },
    });
    const undispatched = await until(async () => {
      const tasks = await orchestrator.journal.listTasks(started.run_id);
      return tasks[0] ?? null;
    });
    expect(undispatched.status).toBe("scheduled");
    expect(undispatched.dispatched_at_ms).toBeUndefined();
    await orchestrator.stop();

    // Phase 3 — a full host on the same file finishes the job.
    const full = await start({
      ...baseOptions(box),
      journal: box.journalUrl,
      workers: [exampleWorker({ workMs: 1 }).worker],
    });
    const finished = createClient({ fetch: full.fetch });
    await finished.waitFor(started.run_id, "awaiting_signal");
    await finished.signal(started.run_id, approve, { by: "late-joiner" });
    const completed = await finished.waitFor(started.run_id, "completed");
    expect(completed.output).toMatchObject({ "example.plan": { items: ["item-0"] } });
  });

  it("re-pushes a dispatch that was never recorded, and the worker runs it once", async () => {
    const box = await sandbox();
    boxes.push(box);

    const activity = exampleWorker({ planMs: 200, workMs: 1 });
    const host = await start({
      ...baseOptions(box),
      // The crash: the push happened, the transaction that would record it did not.
      journal: dropFirstMarkDispatched(openJournal(box.journalUrl)),
      workers: [activity.worker],
      // No claim hold, so the very next tick may re-claim the still-undispatched task.
      dispatcher: { tickMs: 20, claimHoldMs: 0 },
    });

    const client = createClient({ fetch: host.fetch });
    const started = await client.start(exampleWorkflow, { n: 1 });
    await client.waitFor(started.run_id, "awaiting_signal", 15_000);

    const events = await client.events(started.run_id);
    const planStep = events.find(
      (e) => e.kind === "task" && e.status === "scheduled" && e.schema_ref === plan.schemaRef,
    );
    expect(planStep).toBeDefined();

    const done = events.filter(
      (e) => e.kind === "task" && e.status === "succeeded" && e.step_id === planStep?.step_id,
    );
    expect(done).toHaveLength(1);

    const planRuns = activity.executions().filter((key) => key.includes(planStep?.step_id ?? "?"));
    expect(planRuns).toHaveLength(1);
  });
});

/**
 * A journal that loses exactly one `markDispatched`, the way a process dying between the
 * push and the commit would. Everything else passes straight through.
 */
function dropFirstMarkDispatched(inner: Journal): Journal {
  let dropped = false;

  return Object.create(inner, {
    transaction: {
      value: <T>(fn: (tx: JournalTx) => Promise<T>): Promise<T> =>
        inner.transaction((tx) =>
          fn(
            new Proxy(tx, {
              get(target, property, receiver) {
                if (property === "markDispatched" && !dropped) {
                  dropped = true;
                  return () => Promise.reject(new Error("crash before markDispatched"));
                }
                const value = Reflect.get(target, property, receiver) as unknown;
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          ),
        ),
    },
  }) as Journal;
}
