/** Two tools, a decider constrained to them, a scorer, and the signal that raises the budget. */

import { budgetTopup, decision } from "@oona/vlo/agent";
import { activity } from "@oona/vlo";
import { z } from "zod";

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

/** What `agentLoop` sends the decider: the goal plus everything it has learned so far. */
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
