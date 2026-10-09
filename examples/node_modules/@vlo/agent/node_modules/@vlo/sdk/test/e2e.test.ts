/**
 * The whole engine, in one process: start → plan → fan out → park on a signal → finish.
 *
 * Everything runs through the real routes; `createClient({ fetch: host.fetch })` is the only
 * shortcut, and it only skips the socket.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cmd, defineWorkflow, WorkflowFailure, type Json } from "../src/index.ts";
import { createClient, createHost, defineWorker, type Host } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, type Sandbox } from "./support.ts";

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

async function startHost(overrides: Partial<Parameters<typeof createHost>[0]> = {}) {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [exampleWorkflow],
    activities: [plan, work, finish],
    signals: [approve],
    dispatcher: { tickMs: 10 },
    ...overrides,
  });
  open.push({ host, box });
  await host.start();
  return { host, box };
}

describe("end to end", () => {
  it("runs plan → fanOut → signal → finish", async () => {
    const worker = exampleWorker({ workMs: 25 });
    const { host } = await startHost({ workers: [worker.worker] });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(exampleWorkflow, { n: 3 });
    const parked = await client.waitFor(started.run_id, "awaiting_signal");
    expect(parked.status).toBe("awaiting_signal");

    const events = await client.events(started.run_id);
    const scheduled = events.filter((e) => e.kind === "task" && e.status === "scheduled");
    expect(scheduled.filter((e) => e.schema_ref === plan.schemaRef)).toHaveLength(1);
    expect(scheduled.filter((e) => e.schema_ref === work.schemaRef)).toHaveLength(3);
    expect(scheduled.map((e) => e.step_id)).toContain("example.work#0");
    expect(worker.peakConcurrency()).toBeLessThanOrEqual(2);

    const signalled = await client.signal(started.run_id, approve, { by: "dc" });
    expect(signalled.delivered).toBe(true);

    const completed = await client.waitFor(started.run_id, "completed");
    const results = completed.output as Record<string, Json>;
    expect(results["example.plan"]).toEqual({ items: ["item-0", "item-1", "item-2"] });
    expect(results["example.work"]).toEqual([
      { upper: "ITEM-0" },
      { upper: "ITEM-1" },
      { upper: "ITEM-2" },
    ]);
    expect(results["example.finish"]).toEqual({
      report: "ITEM-0,ITEM-1,ITEM-2 approved by dc",
    });

    const checkpoint = await host.journal.getState(started.run_id);
    expect(checkpoint?.seq).toBe(completed.last_seq);

    const listed = await client.list({ status: "completed" });
    expect(listed.map((r) => r.run_id)).toContain(started.run_id);
  });

  it("buffers a signal that arrives before the wait opens", async () => {
    const worker = exampleWorker({ workMs: 1 });
    const { host } = await startHost({ workers: [worker.worker] });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(exampleWorkflow, { n: 1 });
    const early = await client.signal(started.run_id, approve, { by: "early" });
    expect(early.delivered).toBe(false);

    const completed = await client.waitFor(started.run_id, "completed");
    const results = completed.output as Record<string, Json>;
    expect(results["example.finish"]).toEqual({ report: "ITEM-0 approved by early" });
  });

  it("retries an activity that throws, on a fresh attempt", async () => {
    const worker = exampleWorker({ workMs: 1 });
    worker.failNext("example.plan");

    const { host } = await startHost({ workers: [worker.worker] });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(exampleWorkflow, { n: 1 });
    await client.waitFor(started.run_id, "awaiting_signal", 15_000);

    const events = await client.events(started.run_id);
    const retry = events.find((e) => e.kind === "task" && e.status === "retrying");
    expect(retry?.attempt).toBe(2);
    expect(JSON.parse(retry?.payload ?? "{}")).toHaveProperty("delay_ms");

    // Two attempts, two idempotency keys, two executions — the retry is not a redelivery.
    const planRuns = worker.executions().filter((key) => key.endsWith(":1") || key.endsWith(":2"));
    expect(planRuns.filter((key) => key.includes("task#1"))).toHaveLength(2);
  });

  it("fails the run when the reducer throws, keeping the prior checkpoint", async () => {
    const thrower = defineWorkflow("thrower", {
      init: (input: { n: number }) => ({ stage: "started", n: input.n }),
      on: {
        started: (state) => [{ ...state, stage: "planning" }, [cmd.task(plan, { n: state.n })]],
        task_done: () => {
          throw new WorkflowFailure("the reducer refused this result");
        },
      },
    });

    const worker = exampleWorker({ workMs: 1 });
    const { host } = await startHost({ workflows: [thrower], workers: [worker.worker] });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(thrower, { n: 1 });
    const failed = await client.waitFor(started.run_id, "failed");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("the reducer refused this result");
    expect(failed.cause).toBe("app_error");

    const events = await client.events(started.run_id);
    const marker = events.find((e) => e.kind === "marker" && e.step_id === "fail");
    expect(marker?.cause).toBe("app_error");
    expect(marker?.error).toBe("the reducer refused this result");

    // The task result the reducer refused never reaches the journal, so the marker carries it.
    const scheduled = events.find((e) => e.kind === "task" && e.status === "scheduled");
    expect(JSON.parse(marker?.payload ?? "null")).toMatchObject({
      kind: "task",
      status: "succeeded",
      step_id: scheduled?.step_id,
    });

    // The checkpoint is the state from *before* the event that failed.
    const checkpoint = await host.journal.getState(started.run_id);
    expect(JSON.parse(checkpoint?.state ?? "null")).toEqual({ stage: "planning", n: 1 });
  });

  it("fails a task whose output does not match the activity schema", async () => {
    const liar = defineWorker({
      "example.plan": () => ({ items: "not an array" }),
    });

    const { host } = await startHost({ workers: [liar] });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(exampleWorkflow, { n: 2 });
    const failed = await client.waitFor(started.run_id, "failed");
    expect(failed.error).toContain("returned an invalid output");

    // The task result that broke the reducer is rolled back with its transaction, so the
    // `fail` marker is where the schema violation is recorded: the reducer's message as
    // `error`, the refused task event as the payload.
    const events = await client.events(started.run_id);
    const marker = events.find((e) => e.kind === "marker" && e.step_id === "fail");
    expect(marker?.cause).toBe("app_error");
    expect(marker?.error).toContain("returned an invalid output");
    expect(JSON.parse(marker?.payload ?? "null")).toMatchObject({ kind: "task", status: "failed", cause: "schema_violation" });
    expect(events.some((e) => e.kind === "task" && e.status === "scheduled")).toBe(true);
  });
});
