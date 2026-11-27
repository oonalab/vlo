/** The scripted agent both test suites drive: two tools, a decider and a scorer. */

import { activity } from "../../src/index.ts";
import { z } from "zod";
import { budgetTopup, decision } from "../../src/agent/index.ts";

export const draft = activity("agent.draft", {
  input: z.object({ topic: z.string() }),
  output: z.object({ text: z.string() }),
});

export const rewrite = activity("agent.rewrite", {
  input: z.object({ text: z.string() }),
  output: z.object({ text: z.string() }),
});

export const evaluate = activity("agent.evaluate", {
  input: z.object({ goal: z.unknown(), candidate: z.unknown() }),
  output: z.object({ score: z.number() }),
});

/** What `agentLoop` sends a decider: the goal plus everything it has learned. */
export const decide = decision("agent.decide", {
  input: z.object({
    goal: z.unknown(),
    memory: z.array(z.unknown()),
    candidate: z.unknown(),
    score: z.unknown(),
  }),
  tools: { draft, rewrite },
});

export const topup = budgetTopup();

export const tools = { draft, rewrite };
