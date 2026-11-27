/**
 * Deterministic stand-ins for an LLM: every handler is a pure function of its input, so a
 * redelivery or a replay produces the same action. Each reports the tokens it "spent";
 * the kernel banks them and the loop's budget is a decision over that total.
 */

import { defineWorker } from "@oona/vlo";

const TOKENS = { decide: 10, draft: 5, rewrite: 5, evaluate: 3 };

export default defineWorker({
  "agent.decide": (input: { memory: unknown[]; candidate: { text?: string } | null }, ctx) => {
    ctx.reportUsage({ tokens: TOKENS.decide });
    const pass = input.memory.length;
    if (pass === 0) return { tool: "draft", args: { topic: "durable execution" }, rationale: "nothing yet" };
    if (pass === 1 && input.candidate?.text !== undefined) {
      return { tool: "rewrite", args: { text: input.candidate.text }, rationale: "tighten it" };
    }
    return { tool: "done", rationale: "good enough" };
  },

  "agent.draft": (input: { topic: string }, ctx) => {
    ctx.reportUsage({ tokens: TOKENS.draft });
    return { text: `a first draft about ${input.topic}` };
  },

  "agent.rewrite": (input: { text: string }, ctx) => {
    ctx.reportUsage({ tokens: TOKENS.rewrite });
    return { text: input.text.replace("a first draft", "a polished headline") };
  },

  "agent.evaluate": (input: { candidate: { text: string } }, ctx) => {
    ctx.reportUsage({ tokens: TOKENS.evaluate });
    return { score: input.candidate.text.includes("polished") ? 0.95 : 0.4 };
  },
});
