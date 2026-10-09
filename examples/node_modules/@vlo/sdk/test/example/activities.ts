/** Activities and signals for the example workflow used by the helper and e2e tests. */

import { z } from "zod";
import { activity, signal } from "../../src/index.ts";

export const plan = activity("example.plan", {
  input: z.object({ n: z.number().int().positive() }),
  output: z.object({ items: z.array(z.string()) }),
});

export const work = activity("example.work", {
  input: z.object({ item: z.string() }),
  output: z.object({ upper: z.string() }),
  retry: { maxAttempts: 3 },
});

export const finish = activity("example.finish", {
  input: z.object({ uppers: z.array(z.string()), approvedBy: z.string() }),
  output: z.object({ report: z.string() }),
});

export const approve = signal("example.approve", z.object({ by: z.string() }));
