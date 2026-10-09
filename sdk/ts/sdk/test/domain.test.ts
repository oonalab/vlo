/** `defineDomain` + `createHost({ domains })`: registries flatten, roles derive, conflicts are refused. */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineDomain, defineWorkflow, sequence, signal, step } from "../src/index.ts";
import { createClient, createHost, defineWorker, mergeDomains, type Host } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, type Sandbox } from "./support.ts";

const render = activity("dom.render", {
  input: z.object({ clip: z.string() }),
  output: z.object({ rendered: z.string() }),
  queue: "gpu",
});
const rendering = defineWorkflow("dom.rendering", sequence([step(render)]));
const gpuWorker = defineWorker({ "dom.render": (input: { clip: string }) => ({ rendered: input.clip }) }, { queues: ["gpu"] });
const nudge = signal("dom.nudge", z.object({}));

const exampleDomain = defineDomain({
  name: "example",
  workflows: [exampleWorkflow],
  workers: [exampleWorker({ workMs: 1 }).worker],
  activities: [plan, work, finish],
  signals: [approve],
});
const gpuDomain = defineDomain({ name: "gpu", workflows: [rendering], workers: [gpuWorker], activities: [render], signals: [nudge] });

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0).reverse()) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

describe("mergeDomains", () => {
  it("flattens domains onto the four registries, with flat options first", () => {
    const merged = mergeDomains({ domains: [exampleDomain, gpuDomain], signals: [nudge] });

    expect(merged.workflows.map((w) => w.name)).toEqual([exampleWorkflow.name, rendering.name]);
    expect(merged.workers).toHaveLength(2);
    expect(merged.activities.map((a) => a.name)).toEqual([plan.name, work.name, finish.name, render.name]);
    // The same signal registered twice is one registration.
    expect(merged.signals.map((s) => s.name)).toEqual([nudge.name, approve.name]);
  });

  it("refuses two domains with one name and two definitions under one name", () => {
    expect(() => mergeDomains({ domains: [gpuDomain, defineDomain({ name: "gpu" })] })).toThrow(/two domains are named "gpu"/);

    const other = activity("dom.render", { input: z.object({}), output: z.object({}) });
    expect(() => mergeDomains({ domains: [gpuDomain], activities: [other] })).toThrow(/two different activity definitions/);
  });

  it("defaults every registry to empty", () => {
    expect(defineDomain({ name: "bare" })).toEqual({ kind: "domain", name: "bare", workflows: [], workers: [], activities: [], signals: [] });
  });
});

describe("createHost({ domains })", () => {
  it("derives worker roles from the domains' workers and runs their workflows", async () => {
    const box = await sandbox();
    const host = createHost({ journal: box.journalUrl, blob: box.blobUrl, domains: [exampleDomain, gpuDomain], dispatcher: { tickMs: 10 } });
    open.push({ host, box });
    await host.start();

    expect([...host.roles].sort()).toEqual(["api", "orchestrator", "worker:default", "worker:gpu"]);

    const client = createClient({ fetch: host.fetch });
    const started = await client.start(rendering, { clip: "reel" });
    const done = await client.waitFor(started.run_id, "completed");
    expect((done.output as Record<string, unknown>)[render.name]).toEqual({ rendered: "reel" });
  });
});
