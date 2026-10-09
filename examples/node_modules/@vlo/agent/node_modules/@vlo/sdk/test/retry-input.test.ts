/**
 * `withRetryInput`: the second attempt sees the shaped input, the journal keeps the
 * original, and `ctx.runId` names the run. Runs against a real host with an in-process worker.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, sequence, step } from "../src/index.ts";
import { createClient, createHost, defineWorker, withRetryInput, type Host } from "../src/host.ts";
import { sandbox, type Sandbox } from "./support.ts";

const ask = activity("retry.ask", {
  input: z.object({ prompt: z.string() }),
  output: z.object({ answer: z.string() }),
  retry: { maxAttempts: 2, initialMs: 0 },
});

const asking = defineWorkflow("retry.asking", sequence([step(ask)]));

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0).reverse()) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

describe("withRetryInput", () => {
  it("shapes the input on attempt 2 only and leaves the journaled input alone", async () => {
    const seen: { attempt: number; prompt: string; runId: string }[] = [];
    const worker = defineWorker({
      "retry.ask": withRetryInput(
        (input: { prompt: string }, ctx) => {
          seen.push({ attempt: ctx.attempt, prompt: input.prompt, runId: ctx.runId });
          if (ctx.attempt === 1) throw new Error("looped");
          return { answer: input.prompt.toUpperCase() };
        },
        (input, attempt) => ({ prompt: `${input.prompt.slice(0, 4)} (attempt ${attempt})` }),
      ),
    });

    const box = await sandbox();
    const host = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [asking],
      activities: [ask],
      workers: [worker],
      dispatcher: { tickMs: 10 },
    });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(asking, { prompt: "long prompt" });
    const done = await client.waitFor(started.run_id, "completed", 15_000);

    expect(seen).toEqual([
      { attempt: 1, prompt: "long prompt", runId: started.run_id },
      { attempt: 2, prompt: "long (attempt 2)", runId: started.run_id },
    ]);
    expect((done.output as Record<string, unknown>)[ask.name]).toEqual({ answer: "LONG (ATTEMPT 2)" });

    const scheduled = (await client.events(started.run_id)).filter((e) => e.kind === "task" && e.status === "scheduled");
    expect(scheduled).toHaveLength(1);
    expect(JSON.parse(scheduled[0]?.payload ?? "null")).toEqual({ prompt: "long prompt" });
  });
});
