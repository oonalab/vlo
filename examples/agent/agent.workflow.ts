/**
 * decide → tool → evaluate until the score clears the threshold, the decider says `done`,
 * or the budget runs out — in which case the run parks on the top-up signal instead of
 * failing, keeping everything it has already paid for.
 */

import { agentLoop } from "@oona/vlo/agent";
import { defineWorkflow } from "@oona/vlo";
import { decide, draft, evaluate, rewrite, topup } from "./activities.ts";

export default defineWorkflow(
  "agent",
  agentLoop({
    decide,
    tools: { draft, rewrite },
    evaluate,
    threshold: 0.9,
    // One decide + draft + evaluate cycle reports 18 tokens, so the first cycle exhausts this.
    budget: { tokens: 15 },
    topup,
    maxIterations: 5,
  }),
);
