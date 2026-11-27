/** An agent test with no API key: the example's worker is a scripted model. */

import type { AgentResult } from "@oona/vlo/agent";
import { createClient, createHost, type Host } from "@oona/vlo/host";
import { afterEach, expect, it } from "vitest";
import { sandbox, type Sandbox } from "../support.ts";
import { decide, draft, evaluate, rewrite, topup } from "./activities.ts";
import worker from "./agent.worker.ts";
import agent from "./agent.workflow.ts";

let host: Host;
let box: Sandbox;

afterEach(async () => {
  await host.stop();
  await box.cleanup();
});

it("parks when the budget is spent and resumes on a top-up", async () => {
  box = await sandbox();
  host = createHost({
    journal: box.journal,
    blob: box.blob,
    workflows: [agent],
    activities: [decide, draft, rewrite, evaluate],
    signals: [topup],
    workers: [worker],
    dispatcher: { tickMs: 10 },
  });
  await host.start();
  const client = createClient({ fetch: host.fetch });

  // The first cycle spends 18 tokens against a budget of 15, so the run parks.
  const run = await client.start(agent, { topic: "durable execution" });
  await client.waitFor(run.run_id, "awaiting_signal");

  await client.signal(run.run_id, topup, { tokens: 100 });
  const done = await client.waitFor(run.run_id, "completed");
  const result = done.output as unknown as AgentResult;

  expect(result.candidate).toEqual({ text: "a polished headline about durable execution" });
  expect(result.spent.tokens).toBe(36);
});
