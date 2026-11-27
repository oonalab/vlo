/**
 * The agent layer on the real engine: a scripted decider drafts, is scored, runs out of
 * tokens, parks on `agent.budget_topup`, resumes on the signal and finishes.
 *
 * Everything goes through the real routes; `createClient({ fetch: host.fetch })` only skips
 * the socket.
 */

import { defineWorkflow } from "../../src/index.ts";
import { createClient, createHost, defineWorker, type Host } from "../../src/host.ts";
import { afterEach, describe, expect, it } from "vitest";
import { agentLoop, type AgentResult } from "../../src/agent/index.ts";
import { decide, draft, evaluate, topup } from "./example.ts";
import { sandbox, type Sandbox } from "../support.ts";

/** Tokens each handler reports, small enough that one cycle overruns the budget below. */
const TOKENS = { decide: 10, draft: 5, evaluate: 3 };
/** Overrun after cycle 0 (10 + 5 + 3 = 18) but not before it. */
const BUDGET_TOKENS = 15;

const agent = defineWorkflow(
  "agent.e2e",
  agentLoop({
    decide,
    tools: { draft },
    evaluate,
    // Above the best score the scorer gives, so the decider gets to say `done` itself.
    threshold: 0.9,
    budget: { tokens: BUDGET_TOKENS },
    topup,
    maxIterations: 5,
  }),
);

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

/**
 * The scripted "LLM". Every decision is a pure function of the memory it is shown, so a
 * redelivery or a replay produces the same action — no counters, no drift.
 */
function scriptedWorker(spend: (tokens: number) => void) {
  return defineWorker({
    "agent.decide": (input: { memory: unknown[] }, ctx) => {
      ctx.reportUsage({ tokens: TOKENS.decide });
      spend(TOKENS.decide);
      const pass = input.memory.length;
      if (pass >= 2) return { tool: "done", rationale: "the second pass is good enough" };
      return { tool: "draft", args: { topic: `pass ${pass}` }, rationale: `drafting pass ${pass}` };
    },

    "agent.draft": (input: { topic: string }, ctx) => {
      ctx.reportUsage({ tokens: TOKENS.draft });
      spend(TOKENS.draft);
      return { text: `draft of ${input.topic}` };
    },

    "agent.evaluate": (input: { candidate: { text: string } }, ctx) => {
      ctx.reportUsage({ tokens: TOKENS.evaluate });
      spend(TOKENS.evaluate);
      return { score: input.candidate.text.includes("pass 0") ? 0.4 : 0.8 };
    },
  });
}

async function startHost(worker: ReturnType<typeof scriptedWorker>) {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [agent],
    activities: [decide, draft, evaluate],
    signals: [topup],
    workers: [worker],
    dispatcher: { tickMs: 10 },
  });
  open.push({ host, box });
  await host.start();
  return host;
}

describe("agent e2e", () => {
  it("parks on the budget, resumes on a top-up and completes", async () => {
    let reported = 0;
    const host = await startHost(scriptedWorker((tokens) => (reported += tokens)));
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(agent, { goal: "write a headline" });

    const parked = await client.waitFor(started.run_id, "awaiting_signal");
    expect(parked.status).toBe("awaiting_signal");
    expect(reported).toBe(TOKENS.decide + TOKENS.draft + TOKENS.evaluate);

    const events = await client.events(started.run_id);
    const wait = events.find((event) => event.kind === "signal" && event.status === "awaiting_signal");
    expect(wait?.step_id).toBe("topup#1");

    const delivered = await client.signal(started.run_id, topup, { tokens: 100 });
    expect(delivered.delivered).toBe(true);

    const completed = await client.waitFor(started.run_id, "completed");
    const result = completed.output as unknown as AgentResult;

    expect(result.candidate).toEqual({ text: "draft of pass 1" });
    expect(result.score).toBe(0.8);
    expect(result.iterations).toBe(3);
    expect(result.exhausted).toBeUndefined();
    // The kernel banked exactly what the handlers reported.
    expect(result.spent.tokens).toBe(reported);
    expect(reported).toBe(3 * TOKENS.decide + 2 * TOKENS.draft + 2 * TOKENS.evaluate);
  });

  it("parks exactly once", async () => {
    const host = await startHost(scriptedWorker(() => {}));
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(agent, { goal: "write a headline" });
    await client.waitFor(started.run_id, "awaiting_signal");
    await client.signal(started.run_id, topup, { tokens: 100 });
    await client.waitFor(started.run_id, "completed");

    const events = await client.events(started.run_id);
    const parks = events.filter((event) => event.status === "awaiting_signal");
    expect(parks).toHaveLength(1);

    const emitted = events.filter((event) => event.kind === "task" && event.status === "scheduled");
    expect(emitted.map((event) => event.step_id)).toEqual([
      "decide#0",
      "tool#0",
      "evaluate#0",
      "decide#1",
      "tool#1",
      "evaluate#1",
      "decide#2",
    ]);
  });
});
