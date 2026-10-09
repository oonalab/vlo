/**
 * `fanOutRuns` against a real host: the parent spawns children through the outbox, the
 * dispatcher notifies it as each child closes, and a tolerated failure does not stop it.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, fanOutRuns, fanOutRunsResultsOf, sequence, step, type ChildResult } from "../src/index.ts";
import { createClient, createHost, defineWorker, type Host } from "../src/host.ts";
import { sandbox, type Sandbox } from "./support.ts";

const read = activity("fan.read", {
  input: z.object({ item: z.string() }),
  output: z.object({ upper: z.string() }),
  retry: { maxAttempts: 1 },
});

const summarise = activity("fan.summarise", {
  input: z.object({ read: z.number(), failed: z.number() }),
  output: z.object({ line: z.string() }),
});

/** One child per item; the child itself is a one-step sequence over `read`. */
const child = defineWorkflow("fan.child", sequence([step(read)], { output: (s) => s.results[read.name] ?? null }));

const parent = defineWorkflow(
  "fan.parent",
  sequence([
    fanOutRuns(child, (s) => (s.input as { items: string[] }).items.map((item) => ({ item })), {
      concurrency: 2,
      onFailure: "continue",
    }),
    step(summarise, (s) => {
      const results = fanOutRunsResultsOf<{ upper: string }>(s, child);
      return { read: results.filter((r) => r.status === "succeeded").length, failed: results.filter((r) => r.status !== "succeeded").length };
    }),
  ]),
);

const worker = defineWorker({
  "fan.read": (input: { item: string }) => {
    if (input.item === "bad") throw new Error("unreadable");
    return { upper: input.item.toUpperCase() };
  },
  "fan.summarise": (input: { read: number; failed: number }) => ({ line: `${input.read} read, ${input.failed} failed` }),
});

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0).reverse()) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

describe("fanOutRuns on a host", () => {
  it("spawns the children, tolerates one failing and completes the parent", async () => {
    const box = await sandbox();
    const host = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [parent, child],
      activities: [read, summarise],
      workers: [worker],
      dispatcher: { tickMs: 10 },
    });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(parent, { items: ["a", "bad", "c"] });
    const done = await client.waitFor(started.run_id, "completed", 15_000);

    const results = (done.output as Record<string, unknown>)[child.name] as ChildResult<{ upper: string }>[];
    expect(results.map((r) => r.status)).toEqual(["succeeded", "failed", "succeeded"]);
    expect(results[0]?.output).toEqual({ upper: "A" });
    expect(results[1]?.output).toBeNull();
    expect((done.output as Record<string, unknown>)[summarise.name]).toEqual({ line: "2 read, 1 failed" });

    const children = await client.list({ workflow: child.name });
    expect(children).toHaveLength(3);
    for (const run of children) expect(run.parent_run_id).toBe(started.run_id);
    expect(children.filter((run) => run.status === "failed")).toHaveLength(1);

    const childEvents = (await client.events(started.run_id)).filter((e) => e.kind === "child" && e.status !== "scheduled");
    expect(childEvents.map((e) => e.step_id).sort()).toEqual([`${child.name}#0`, `${child.name}#1`, `${child.name}#2`]);
  });
});
