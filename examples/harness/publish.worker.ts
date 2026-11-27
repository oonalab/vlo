/** The action the pipeline takes once a person has approved the agent's draft. */

import { defineWorker } from "@oona/vlo";

export default defineWorker({
  "publish.post": async (input: { approvedBy: string }) => ({
    url: `https://example.com/posts/approved-by-${input.approvedBy}`,
  }),
});
