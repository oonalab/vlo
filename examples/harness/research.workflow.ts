/**
 * The agent: decide → tool → evaluate until the score clears the threshold or the budget is
 * spent. `publish` reaches the outside world, so it waits for a person's yes first.
 */

import { defineWorkflow } from "@oona/vlo";
import { agentLoop } from "@oona/vlo/agent";
import { decide, evaluate, publish, search, topup, write } from "./activities.ts";

export default defineWorkflow(
  "research",
  agentLoop({
    decide,
    tools: { search, write, publish },
    evaluate,
    threshold: 0.9,
    budget: { tokens: 50_000, costMicroUsd: 2_000_000 },
    topup,
    approval: { tools: ["publish"], timeoutMs: 172_800_000 },
    maxIterations: 30,
  }),
);
