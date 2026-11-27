/** The harness on the real engine, with the scripted model: no socket, no API key. */

import { approvalSignal, type AgentResult } from "@oona/vlo/agent";
import { createClient, createHost, type Host } from "@oona/vlo/host";
import { afterEach, expect, it } from "vitest";
import { sandbox, type Sandbox } from "../support.ts";
import { decide, evaluate, publish, search, topup, write } from "./activities.ts";
import worker from "./research.worker.ts";
import research from "./research.workflow.ts";

let host: Host;
let box: Sandbox;

afterEach(async () => {
  await host.stop();
  await box.cleanup();
});

/** Starts the agent and returns once it is waiting for a yes on `publish`. */
async function untilAsked() {
  box = await sandbox();
  host = createHost({
    journal: box.journal,
    blob: box.blob,
    workflows: [research],
    activities: [decide, search, write, publish, evaluate],
    signals: [topup],
    workers: [worker],
    auth: { linkSecret: "a secret only this test knows" },
    dispatcher: { tickMs: 10 },
  });
  await host.start();
  const client = createClient({ fetch: host.fetch });

  const run = await client.start(research, { topic: "durable execution" });
  await client.waitFor(run.run_id, "awaiting_signal");
  return { client, run };
}

it("searches and writes, then waits for a yes before it publishes", async () => {
  const { client, run } = await untilAsked();

  // Two cycles ran; the third picked `publish`, which is gated, so nothing was dispatched.
  const steps = (await client.events(run.run_id))
    .filter((event) => event.kind !== "timer")
    .filter((event) => event.status === "scheduled" || event.status === "awaiting_signal")
    .map((event) => event.step_id);
  expect(steps).toEqual([
    "decide#0", "tool#0", "evaluate#0",
    "decide#1", "tool#1", "evaluate#1",
    "decide#2", "approve#2",
  ]);

  await client.signal(run.run_id, approvalSignal(2), { approved: true, by: "dana" });
  const done = await client.waitFor(run.run_id, "completed");
  const result = done.output as unknown as AgentResult;

  expect(result.candidate).toEqual({ url: "https://example.com/posts/73" });
  expect(result.score).toBe(0.95);
  // Three decisions and one write: the kernel banked exactly what the workers reported.
  expect(result.spent.tokens).toBe(1_800);
});

it("does not publish when the answer is no", async () => {
  const { client, run } = await untilAsked();

  await client.signal(run.run_id, approvalSignal(2), { approved: false, reason: "not this week" });
  const done = await client.waitFor(run.run_id, "completed");
  const result = done.output as unknown as AgentResult;

  // The run still finishes, with the report it wrote and no post.
  expect(result.candidate).toEqual({
    text: "A short report. what durable execution is; why durable execution matters.",
  });
  const ran = (await client.events(run.run_id)).map((event) => event.step_id);
  expect(ran).not.toContain("tool#2");
});

it("can be approved from a signed link", async () => {
  const { client, run } = await untilAsked();

  const link = await client.signalLink(run.run_id, approvalSignal(2), { expiresInMs: 86_400_000 });
  // Opening the link changes nothing; confirming the form is what approves.
  await host.fetch(new Request(link.url));
  expect((await client.get(run.run_id)).status).toBe("awaiting_signal");
  await host.fetch(new Request(link.url, { method: "POST" }));

  const done = await client.waitFor(run.run_id, "completed");
  expect((done.output as unknown as AgentResult).candidate).toEqual({ url: "https://example.com/posts/73" });
});
