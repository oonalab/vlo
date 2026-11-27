/** The agent: decide → tool → evaluate until the score clears the threshold or the budget is spent. */

import { defineWorkflow } from "@oona/vlo";
import { agentLoop } from "@oona/vlo/agent";
import { decide, evaluate, search, topup, write } from "./activities.ts";

export default defineWorkflow(
  "research",
  agentLoop({
    decide,
    tools: { search, write },
    evaluate,
    threshold: 0.9,
    budget: { tokens: 50_000, costMicroUsd: 2_000_000 },
    topup,
    maxIterations: 30,
  }),
);
