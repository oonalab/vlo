/** The harness on the real engine, with the scripted model: no socket, no API key. */

import { createClient, createHost, type Host } from "@oona/vlo/host";
import type { AgentResult } from "@oona/vlo/agent";
import { afterEach, expect, it } from "vitest";
import { sandbox, type Sandbox } from "../support.ts";
import { approve, decide, evaluate, publish, search, topup, write } from "./activities.ts";
import publishWorker from "./publish.worker.ts";
import publishWorkflow from "./publish.workflow.ts";
import worker from "./research.worker.ts";
import research from "./research.workflow.ts";

let host: Host;
let box: Sandbox;

afterEach(async () => {
  await host.stop();
  await box.cleanup();
});

async function start() {
  box = await sandbox();
  host = createHost({
    journal: box.journal,
    blob: box.blob,
    workflows: [research, publishWorkflow],
    activities: [decide, search, write, evaluate, publish],
    signals: [topup, approve],
    workers: [worker, publishWorker],
    dispatcher: { tickMs: 10 },
  });
  await host.start();
  return createClient({ fetch: host.fetch });
}

it("searches, writes, and stops when the score clears the threshold", async () => {
  const client = await start();

  const run = await client.start(research, { topic: "durable execution" });
  const done = await client.waitFor(run.run_id, "completed");
  const result = done.output as unknown as AgentResult;

  expect(result.candidate).toEqual({
    text: "A short report. what durable execution is; why durable execution matters.",
  });
  expect(result.score).toBe(0.95);
  // Two decisions and one write: the kernel banked exactly what the workers reported.
  expect(result.spent.tokens).toBe(1_400);

  const steps = (await client.events(run.run_id))
    .filter((event) => event.kind === "task" && event.status === "scheduled")
    .map((event) => event.step_id);
  expect(steps).toEqual(["decide#0", "tool#0", "evaluate#0", "decide#1", "tool#1", "evaluate#1"]);
});

it("waits for a person before publishing what the agent wrote", async () => {
  const client = await start();

  const run = await client.start(publishWorkflow, { topic: "durable execution" });
  await client.waitFor(run.run_id, "awaiting_signal");

  await client.signal(run.run_id, approve, { by: "dana" });
  const done = await client.waitFor(run.run_id, "completed");

  expect(done.output).toMatchObject({
    "publish.post": { url: "https://example.com/posts/approved-by-dana" },
  });
});
