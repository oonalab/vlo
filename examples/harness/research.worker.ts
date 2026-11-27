/** The agent's workers. Every model call reports what it spent, so the budget means something. */

import { defineWorker } from "@oona/vlo";
import { decideNext, grade, webSearch, writeReport, type DecideInput } from "./model.ts";

export default defineWorker({
  "research.decide": async (input: DecideInput, ctx) => {
    const reply = await decideNext(input);
    ctx.reportUsage({ tokens: reply.tokens, costMicroUsd: reply.costMicroUsd });
    return { tool: reply.tool, args: reply.args ?? null, rationale: reply.why };
  },

  "research.search": async (input: { query: string }) => ({
    results: await webSearch(input.query),
  }),

  "research.write": async (input: { notes: string }, ctx) => {
    const reply = await writeReport(input.notes);
    ctx.reportUsage({ tokens: reply.tokens, costMicroUsd: reply.costMicroUsd });
    return { text: reply.text };
  },

  "research.evaluate": async (input: { goal: unknown; candidate: unknown }) => ({
    score: await grade(input.goal, input.candidate),
  }),
});
