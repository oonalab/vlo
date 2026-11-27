/** The agent's tools, its decision, its scorer, and the approval gate around it. */

import { activity, signal } from "@oona/vlo";
import { budgetTopup, decision } from "@oona/vlo/agent";
import { z } from "zod";

export const search = activity("research.search", {
  input: z.object({ query: z.string() }),
  output: z.object({ results: z.array(z.string()) }),
});

export const write = activity("research.write", {
  input: z.object({ notes: z.string() }),
  output: z.object({ text: z.string() }),
});

export const evaluate = activity("research.evaluate", {
  input: z.object({ goal: z.unknown(), candidate: z.unknown() }),
  output: z.object({ score: z.number() }),
});

export const decide = decision("research.decide", {
  input: z.object({
    goal: z.unknown(),
    memory: z.array(z.unknown()),
    candidate: z.unknown(),
    score: z.unknown(),
  }),
  tools: { search, write },
});

export const topup = budgetTopup();

export const publish = activity("publish.post", {
  input: z.object({ draft: z.unknown(), approvedBy: z.string() }),
  output: z.object({ url: z.string() }),
});

export const approve = signal("publish.approve", z.object({ by: z.string().optional() }));
