/**
 * The checkpoint is a cache, and the journal is the truth.
 *
 * Losing the checkpoint costs a replay. *Disagreeing* with the journal is nondeterminism:
 * the run is failed with a marker rather than carried forward on state nobody can reproduce.
 */

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { createClient, createHost, type Host } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, type Sandbox } from "./support.ts";

const hosts: Host[] = [];
const boxes: Sandbox[] = [];

afterEach(async () => {
  for (const host of hosts.splice(0).reverse()) await host.stop();
  for (const box of boxes.splice(0)) await box.cleanup();
});

async function hostOn(box: Sandbox, roles?: ("api" | "orchestrator" | `worker:${string}`)[]) {
  const worker = exampleWorker({ workMs: 1 });
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [exampleWorkflow],
    activities: [plan, work, finish],
    signals: [approve],
    workers: [worker.worker],
    dispatcher: { tickMs: 20 },
    ...(roles !== undefined ? { roles } : {}),
  });
  hosts.push(host);
  await host.start();
  return host;
}

/** Runs the example up to its signal wait, then closes the host so the file is free. */
async function parkedRun(box: Sandbox): Promise<string> {
  const host = await hostOn(box);
  const client = createClient({ fetch: host.fetch });
  const started = await client.start(exampleWorkflow, { n: 2 });
  await client.waitFor(started.run_id, "awaiting_signal");
  await host.stop();
  return started.run_id;
}

function sql(dbPath: string, statement: string, params: unknown[]): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(statement).run(...(params as never[]));
  } finally {
    db.close();
  }
}

describe("re-fold", () => {
  it("fails the run when the checkpoint disagrees with the journal", async () => {
    const box = await sandbox();
    boxes.push(box);
    const runId = await parkedRun(box);

    // Bump a number inside the checkpoint. The bytes still parse; the hash no longer matches.
    const inspect = new DatabaseSync(box.dbPath);
    const row = inspect.prepare("SELECT state FROM run_state WHERE run_id = ?").get(runId) as {
      state: string;
    };
    inspect.close();
    const tampered = row.state.replace(/"phase":(\d+)/, (_, n: string) => `"phase":${Number(n) + 1}`);
    expect(tampered).not.toBe(row.state);
    sql(box.dbPath, "UPDATE run_state SET state = ? WHERE run_id = ?", [tampered, runId]);

    const host = await hostOn(box, ["api"]);
    const client = createClient({ fetch: host.fetch });
    await expect(client.signal(runId, approve, { by: "dc" })).rejects.toThrow(/409/);

    const run = await client.get(runId);
    expect(run.status).toBe("failed");

    const marker = (await client.events(runId)).find(
      (e) => e.kind === "marker" && e.step_id === "nondeterminism",
    );
    expect(marker?.cause).toBe("nondeterminism_detected");
  });

  it("rebuilds a missing checkpoint from the journal and carries on", async () => {
    const box = await sandbox();
    boxes.push(box);
    const runId = await parkedRun(box);

    const inspect = new DatabaseSync(box.dbPath);
    const before = inspect
      .prepare("SELECT seq, state, state_hash FROM run_state WHERE run_id = ?")
      .get(runId) as { seq: number; state: string; state_hash: string };
    const trigger = inspect
      .prepare("SELECT state_hash FROM events WHERE run_id = ? AND seq = ?")
      .get(runId, before.seq) as { state_hash: string };
    inspect.close();

    // The checkpoint the replay has to reproduce is the one journaled on that event.
    expect(trigger.state_hash).toBe(before.state_hash);

    sql(box.dbPath, "DELETE FROM run_state WHERE run_id = ?", [runId]);

    const host = await hostOn(box);
    const client = createClient({ fetch: host.fetch });
    const delivered = await client.signal(runId, approve, { by: "rebuilt" });
    expect(delivered.delivered).toBe(true);

    const completed = await client.waitFor(runId, "completed");
    expect(completed.output).toMatchObject({
      "example.finish": { report: "ITEM-0,ITEM-1 approved by rebuilt" },
    });
  });
});
