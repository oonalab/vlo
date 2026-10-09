/**
 * `continue_as_new`. The kernel closes the run as `continued`; the host derives the successor
 * from the `continue` step, inserts it as a `created` row in the same transaction, and the
 * outbox starts it like any other run. The parent link travels with the chain, so a parent
 * hears from whichever run finally closes — once.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cmd, defineWorkflow } from "../src/index.ts";
import { createClient, createHost, type Host } from "../src/host.ts";
import { sandbox, type Sandbox } from "./support.ts";

interface Cursor {
  cursor: number;
}

/** Continues once, then completes with the cursor it was handed. */
const cursor = defineWorkflow("continue.cursor", {
  init: (input: Cursor) => ({ cursor: input.cursor }),
  on: {
    started: (state) =>
      state.cursor < 1
        ? [state, [cmd.continueAsNew({ cursor: state.cursor + 1 })]]
        : [state, [cmd.complete({ cursor: state.cursor })]],
    task_done: (state) => [state, []],
  },
});

const parent = defineWorkflow("continue.parent", {
  init: () => ({ children: 0 }),
  on: {
    started: (state) => [state, [cmd.spawn(cursor, { cursor: 0 }, { id: "child" })]],
    task_done: (state) => [state, []],
    child_done: (state, event) => [
      { children: state.children + 1 },
      [cmd.complete({ children: state.children + 1, child: event.output ?? null })],
    ],
  },
});

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0).reverse()) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

type Options = Parameters<typeof createHost>[0];

async function start(box: Sandbox, options: Partial<Options> = {}): Promise<Host> {
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [cursor, parent],
    dispatcher: { tickMs: 20 },
    ...options,
  });
  open.push({ host, box });
  await host.start();
  return host;
}

describe("continue_as_new", () => {
  it("links the runs and starts the successor from the start-runs stage", async () => {
    const box = await sandbox();
    // Manual mode: nothing moves between ticks, so each stage's work is observable.
    const host = await start(box, { dispatcher: { mode: "manual" } });
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(cursor, { cursor: 0 });
    expect(started.status).toBe("created");

    // Tick 1 starts the original; its `started` fold continues it and inserts the successor.
    expect((await host.tick()).started).toBe(1);
    const continued = await client.get(started.run_id);
    expect(continued.status).toBe("continued");
    expect(continued.continued_from).toBeUndefined();
    const successorId = continued.continued_to;
    if (successorId === undefined) throw new Error("no successor was linked");

    const created = await client.get(successorId);
    expect(created).toMatchObject({
      status: "created",
      workflow: cursor.name,
      continued_from: started.run_id,
    });
    expect(created.continued_to).toBeUndefined();

    // Tick 2: the successor is a `created` row like any other, so start-runs picks it up.
    expect((await host.tick()).started).toBe(1);
    const done = await client.waitFor(successorId, "completed");
    expect(done.output).toEqual({ cursor: 1 });

    const successorEvents = await client.events(successorId);
    expect(successorEvents[0]).toMatchObject({ kind: "marker", step_id: "start" });
    expect(JSON.parse(successorEvents[0]?.payload ?? "null")).toEqual({ cursor: 1 });

    const originalEvents = await client.events(started.run_id);
    expect(originalEvents.at(-1)).toMatchObject({ kind: "marker", step_id: "continue" });
  });

  it("notifies a parent once, with the output of the run that finally closed", async () => {
    const box = await sandbox();
    const host = await start(box);
    const client = createClient({ fetch: host.fetch });

    const started = await client.start(parent, null);
    const done = await client.waitFor(started.run_id, "completed");
    expect(done.output).toEqual({ children: 1, child: { cursor: 1 } });

    const childEvents = (await client.events(started.run_id)).filter(
      (event) => event.kind === "child" && event.status !== "scheduled",
    );
    expect(childEvents).toHaveLength(1);
    expect(childEvents[0]).toMatchObject({ step_id: "child", status: "succeeded" });

    // Both runs in the chain carry the parent link; only the last one produced an event.
    const chain = await client.list({ workflow: cursor.name });
    expect(chain).toHaveLength(2);
    for (const run of chain) expect(run.parent_run_id).toBe(started.run_id);
    const original = chain.find((run) => run.status === "continued");
    const successor = chain.find((run) => run.status === "completed");
    expect(original?.continued_to).toBe(successor?.run_id);
    expect(successor?.continued_from).toBe(original?.run_id);
  });
});
