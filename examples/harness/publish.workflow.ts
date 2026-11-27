/** Run the agent as a child, wait for a person, then act on what it wrote. */

import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, sequence, signalOf, step, waitFor } from "@oona/vlo";
import { approve, publish } from "./activities.ts";
import research from "./research.workflow.ts";

export default defineWorkflow(
  "publish",
  sequence([
    fanOutRuns(research, (state) => [state.input], { concurrency: 1 }),
    waitFor(approve, { timeoutMs: 172_800_000, onTimeout: "fail" }),
    step(publish, (state) => ({
      draft: fanOutRunsResultsOf(state, research)[0]?.output ?? null,
      approvedBy: signalOf(state, approve).by ?? "link",
    })),
  ]),
);
