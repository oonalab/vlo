/**
 * Usage, end to end: a handler reports what it spent, the journal records it on the attempt's
 * event, and the reducer sees both that step's `usage` and the run's banked `usage_total`.
 *
 * The whole point of `usage_total` is that a reducer can decide on a budget without keeping
 * its own tally, so the workflow here records what the kernel handed it rather than summing.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, cmd, defineWorkflow, type Json } from "../src/index.ts";
import { createClient, createHost, defineWorker, type Host } from "../src/host.ts";
import type { Usage } from "../src/kernel/protocol.ts";
import { sandbox, type Sandbox } from "./support.ts";

const spend = activity("usage.spend", {
  input: z.object({ step: z.number() }),
  output: z.object({ step: z.number() }),
  retry: { maxAttempts: 2, initialMs: 0 },
});

interface Seen {
  step: number;
  usage: Usage;
  total: Usage;
}

interface State {
  step: number;
  seen: Seen[];
}

/** Two steps, recording what each `task_done` carried. A failed attempt never lands here. */
const recorder = defineWorkflow<State, Json>("usage.recorder", {
  init: () => ({ step: 0, seen: [] }),
  on: {
    started: (state) => [state, [cmd.task(spend, { step: 0 })]],
    task_done: (state, event) => {
      if (event.status !== "succeeded") return [state, []];
      const seen: Seen[] = [
        ...state.seen,
        { step: state.step, usage: event.usage, total: event.usage_total },
      ];
      const next = state.step + 1;
      return next < 2
        ? [{ step: next, seen }, [cmd.task(spend, { step: next })]]
        : [{ step: next, seen }, [cmd.complete({ seen } as unknown as Json)]];
    },
  },
});

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

async function startHost(handler: Parameters<typeof defineWorker>[0][string]): Promise<Host> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [recorder],
    activities: [spend],
    workers: [defineWorker({ [spend.name]: handler })],
    dispatcher: { tickMs: 10 },
  });
  open.push({ host, box });
  await host.start();
  return host;
}

describe("usage", () => {
  it("carries a handler's spend to the journal and on to the reducer", async () => {
    const host = await startHost((input: { step: number }, ctx) => {
      // Two calls, because a handler bills per model call rather than once at the end.
      ctx.reportUsage({ tokens: 100, costMicroUsd: 5 });
      ctx.reportUsage({ tokens: 20, cpuMs: 7 });
      return { step: input.step };
    });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(recorder, null);
    const completed = await client.waitFor(started.run_id, "completed");

    const { seen } = completed.output as unknown as { seen: Seen[] };
    expect(seen).toEqual([
      {
        step: 0,
        usage: { cpu_ms: 7, tokens: 120, cost_micro_usd: 5 },
        total: { cpu_ms: 7, tokens: 120, cost_micro_usd: 5 },
      },
      {
        step: 1,
        usage: { cpu_ms: 7, tokens: 120, cost_micro_usd: 5 },
        // The run total is cumulative; the step's own usage is not.
        total: { cpu_ms: 14, tokens: 240, cost_micro_usd: 10 },
      },
    ]);

    const succeeded = (await client.events(started.run_id)).filter(
      (event) => event.kind === "task" && event.status === "succeeded",
    );
    expect(succeeded.map((event) => event.usage)).toEqual([
      { cpu_ms: 7, tokens: 120, cost_micro_usd: 5 },
      { cpu_ms: 7, tokens: 120, cost_micro_usd: 5 },
    ]);

    const checkpoint = await host.journal.getState(started.run_id);
    expect(JSON.parse(checkpoint?.kernel_state ?? "{}")).toMatchObject({
      usage_total: { cpu_ms: 14, tokens: 240, cost_micro_usd: 10 },
    });
  });

  it("banks what a failed attempt spent before it threw", async () => {
    let attempts = 0;
    const host = await startHost((input: { step: number }, ctx) => {
      attempts += 1;
      ctx.reportUsage({ tokens: 50 });
      // The first attempt burns its tokens and then fails: spent is spent.
      if (attempts === 1) throw new Error("upstream refused");
      return { step: input.step };
    });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(recorder, null);
    const completed = await client.waitFor(started.run_id, "completed", 15_000);

    const retrying = (await client.events(started.run_id)).find(
      (event) => event.kind === "task" && event.status === "retrying",
    );
    expect(retrying?.usage).toEqual({ cpu_ms: 0, tokens: 50, cost_micro_usd: 0 });

    // Three landed attempts (one failed, two succeeded) at 50 tokens each.
    const { seen } = completed.output as unknown as { seen: Seen[] };
    expect(seen[0]?.total).toEqual({ cpu_ms: 0, tokens: 100, cost_micro_usd: 0 });
    expect(seen[1]?.total).toEqual({ cpu_ms: 0, tokens: 150, cost_micro_usd: 0 });
  });

  it("stamps no usage when the handler reports none", async () => {
    const host = await startHost((input: { step: number }) => ({ step: input.step }));
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(recorder, null);
    const completed = await client.waitFor(started.run_id, "completed");

    const succeeded = (await client.events(started.run_id)).filter(
      (event) => event.kind === "task" && event.status === "succeeded",
    );
    expect(succeeded.every((event) => event.usage === undefined)).toBe(true);

    // The reducer still sees a well-formed zero rather than an absent field.
    const { seen } = completed.output as unknown as { seen: Seen[] };
    expect(seen[0]?.usage).toEqual({ cpu_ms: 0, tokens: 0, cost_micro_usd: 0 });
    expect(seen[1]?.total).toEqual({ cpu_ms: 0, tokens: 0, cost_micro_usd: 0 });
  });
});
