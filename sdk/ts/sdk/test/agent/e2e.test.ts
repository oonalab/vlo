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
import { agentLoop, approvalSignal, type AgentResult } from "../../src/agent/index.ts";
import { decide, draft, evaluate, topup } from "./example.ts";
import { sandbox, sleep, until, type Sandbox } from "../support.ts";

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

  it("waits for a person before a gated tool, and routes around a rejection", async () => {
    const gated = defineWorkflow(
      "agent.gated",
      agentLoop({ decide, tools: { draft }, budget: {}, approval: { tools: ["draft"] }, maxIterations: 5 }),
    );
    const box = await sandbox();
    let drafts = 0;
    const host = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [gated],
      activities: [decide, draft],
      workers: [
        defineWorker({
          "agent.decide": (input: { memory: unknown[] }) =>
            input.memory.length >= 2
              ? { tool: "done", rationale: "one draft got through" }
              : { tool: "draft", args: { topic: `pass ${input.memory.length}` } },
          "agent.draft": (input: { topic: string }) => {
            drafts++;
            return { text: `draft of ${input.topic}` };
          },
        }),
      ],
      dispatcher: { tickMs: 10 },
    });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(gated, { goal: "write a headline" });
    await client.waitFor(started.run_id, "awaiting_signal");
    expect(drafts).toBe(0);

    // No to the first call: nothing runs, and the decider is told why.
    const no = await client.signal(started.run_id, approvalSignal(0), { approved: false, reason: "not yet" });
    expect(no.delivered).toBe(true);

    // The approval for call 0 cannot be replayed onto call 1: it has its own signal.
    await until(async () => {
      const events = await client.events(started.run_id);
      return events.some((event) => event.step_id === "approve#1") ? true : null;
    });
    expect(drafts).toBe(0);
    await client.signal(started.run_id, approvalSignal(1), {});

    const completed = await client.waitFor(started.run_id, "completed");
    const result = completed.output as unknown as AgentResult;
    expect(drafts).toBe(1);
    expect(result.candidate).toEqual({ text: "draft of pass 1" });
  });

  /** An agent whose only tool is gated, with a deadline short enough to miss in a test. */
  async function startGated(onTimeout: "reject" | "fail", name?: string) {
    const gated = defineWorkflow(
      `agent.deadline.${onTimeout}.${name ?? "default"}`,
      agentLoop({
        decide,
        tools: { draft },
        budget: {},
        approval: { tools: ["draft"], timeoutMs: 150, onTimeout, ...(name !== undefined ? { name } : {}) },
        maxIterations: 5,
      }),
    );
    const box = await sandbox();
    let drafts = 0;
    const host = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [gated],
      activities: [decide, draft],
      workers: [
        defineWorker({
          "agent.decide": (input: { memory: { error?: string }[] }) =>
            input.memory.length >= 1
              ? { tool: "done", final: { told: input.memory[0]?.error ?? null } }
              : { tool: "draft", args: { topic: "pass 0" } },
          "agent.draft": (input: { topic: string }) => {
            drafts++;
            return { text: `draft of ${input.topic}` };
          },
        }),
      ],
      dispatcher: { tickMs: 10 },
    });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });
    const started = await client.start(gated, { goal: "write a headline" });
    return { client, runId: started.run_id, drafts: () => drafts };
  }

  it("carries on without the tool when nobody answers before the deadline", async () => {
    const { client, runId, drafts } = await startGated("reject");

    // Nobody signals. The real timer fires and the decider is told.
    const completed = await client.waitFor(runId, "completed");

    expect((completed.output as unknown as AgentResult).candidate).toEqual({ told: "approval timed out" });
    expect(drafts()).toBe(0);
    const events = await client.events(runId);
    expect(events.some((event) => event.step_id === "approve#0:timeout" && event.status === "succeeded")).toBe(true);
    // An answer after the deadline reaches nobody.
    const late = await client.signal(runId, approvalSignal(0), {});
    expect(late.delivered).toBe(false);
  });

  it("fails the run on a missed deadline when configured to", async () => {
    const { client, runId, drafts } = await startGated("fail");

    const failed = await client.waitFor(runId, "failed");

    expect(failed.error).toContain('approval timed out for "draft"');
    expect(drafts()).toBe(0);
  });

  it("is answered on a custom signal name, and an answer in time cancels the deadline", async () => {
    const { client, runId, drafts } = await startGated("fail", "ops.sign_off");
    await client.waitFor(runId, "awaiting_signal");

    // The default name is not what this run waits on.
    expect((await client.signal(runId, approvalSignal(0), {})).delivered).toBe(false);
    expect((await client.signal(runId, approvalSignal(0, "ops.sign_off"), {})).delivered).toBe(true);

    // `onTimeout: "fail"` would fail the run if the deadline still fired; it completes instead.
    const completed = await client.waitFor(runId, "completed");
    expect(drafts()).toBe(1);
    expect(completed.status).toBe("completed");
    // Well past the deadline, the timer has still not fired: the answer retired it.
    await sleep(400);
    const timer = (await client.events(runId)).filter((event) => event.step_id === "approve#0:timeout");
    expect(timer.map((event) => event.status)).toEqual(["scheduled"]);
  });
});
