import { defineWorker } from "@oona/vlo";

export default defineWorker({
  "pipeline.plan": (input: { n: number }) => ({
    items: Array.from({ length: input.n }, (_, i) => `item-${i}`),
  }),

  "pipeline.work": async (input: { item: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { upper: input.item.toUpperCase() };
  },

  "pipeline.finish": (input: { uppers: string[]; approvedBy: string }) => ({
    report: `${input.uppers.join(",")} approved by ${input.approvedBy}`,
  }),
});
