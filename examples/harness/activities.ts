/** The agent's tools, its decision and its scorer. */

import { activity } from "@oona/vlo";
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

export const publish = activity("research.publish", {
  input: z.object({ text: z.string() }),
  output: z.object({ url: z.string() }),
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
  tools: { search, write, publish },
});

export const topup = budgetTopup();
