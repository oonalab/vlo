/**
 * `client.find` and `client.startFresh`: a missing run is `null`, a live run under the key
 * is joined, and once it has ended the next start lands on `${key}_2`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cmd, defineWorkflow, isTerminalRunStatus } from "../src/index.ts";
import { createClient, createHost, type Host } from "../src/host.ts";
import { approve } from "./example/activities.ts";
import { sandbox, type Sandbox } from "./support.ts";

/** Parks on `approve`, then completes with who approved. */
const gated = defineWorkflow("fresh.gated", {
  init: () => ({}),
  on: {
    started: (state) => [state, [cmd.awaitSignal(approve, { id: "gate" })]],
    task_done: (state) => [state, []],
    signal: (state, event) => [state, [cmd.complete(event.payload)]],
  },
});

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0).reverse()) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

describe("startFresh", () => {
  it("walks past ended runs and joins a live one", async () => {
    const box = await sandbox();
    const host = createHost({ journal: box.journalUrl, blob: box.blobUrl, workflows: [gated], signals: [approve], dispatcher: { tickMs: 10 } });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });

    expect(await client.find("fresh_key")).toBeNull();

    const first = await client.startFresh(gated, null, { runId: "fresh_key", search: { spaceId: "s1" } });
    expect(first).toMatchObject({ joined: false, run: { run_id: "fresh_key", search: { spaceId: "s1" } } });
    await client.waitFor("fresh_key", "awaiting_signal");

    const again = await client.startFresh(gated, null, { runId: "fresh_key" });
    expect(again.joined).toBe(true);
    expect(again.run.run_id).toBe("fresh_key");
    expect(isTerminalRunStatus(again.run.status)).toBe(false);

    await client.signal("fresh_key", approve, { by: "dc" });
    const done = await client.waitFor("fresh_key", "completed");
    expect(isTerminalRunStatus(done.status)).toBe(true);
    expect(await client.find("fresh_key")).toMatchObject({ status: "completed" });

    const third = await client.startFresh(gated, null, { runId: "fresh_key" });
    expect(third).toMatchObject({ joined: false, run: { run_id: "fresh_key_2", workflow: gated.name } });
  });

  it("gives up past maxChain", async () => {
    const box = await sandbox();
    const host = createHost({ journal: box.journalUrl, blob: box.blobUrl, workflows: [gated], signals: [approve], dispatcher: { mode: "manual" } });
    open.push({ host, box });
    await host.start();
    const client = createClient({ fetch: host.fetch });

    await client.start(gated, null, { runId: "chain" });
    await client.cancel("chain");
    await expect(client.startFresh(gated, null, { runId: "chain", maxChain: 1 })).rejects.toThrow(/raise maxChain/);
  });
});
