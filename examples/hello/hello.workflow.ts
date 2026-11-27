/**
 * The smallest Vlo program: one activity, then complete.
 *
 * A workflow is a reducer. `started` schedules the task; `task_done` folds its output into
 * the run's result. Nothing here suspends, so a crash between the two events loses nothing.
 */

import { activity, cmd, defineWorkflow, WorkflowFailure } from "@oona/vlo";
import { z } from "zod";

export const greet = activity("hello.greet", {
  input: z.object({ name: z.string() }),
  output: z.object({ greeting: z.string() }),
});

export default defineWorkflow("hello", {
  init: (input: { name: string }) => ({ name: input.name }),
  on: {
    started: (state) => [state, [cmd.task(greet, { name: state.name })]],
    task_done: (state, event) => {
      if (event.status !== "succeeded") throw new WorkflowFailure(event.error ?? "greet failed");
      return [state, [cmd.complete(event.output ?? null)]];
    },
  },
});
