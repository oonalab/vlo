/** Activities and the approval signal the pipeline is built from. */

import { activity, signal } from "@oona/vlo";
import { z } from "zod";

export const plan = activity("pipeline.plan", {
  input: z.object({ n: z.number().int().positive() }),
  output: z.object({ items: z.array(z.string()) }),
});

export const work = activity("pipeline.work", {
  input: z.object({ item: z.string() }),
  output: z.object({ upper: z.string() }),
  retry: { maxAttempts: 3 },
});

export const finish = activity("pipeline.finish", {
  input: z.object({ uppers: z.array(z.string()), approvedBy: z.string() }),
  output: z.object({ report: z.string() }),
});

export const approve = signal("pipeline.approve", z.object({ by: z.string() }));
