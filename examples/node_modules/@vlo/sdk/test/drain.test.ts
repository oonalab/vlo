/**
 * `Host.drain` — carrying a whole chain inside one invocation.
 *
 * On a serverless orchestrator the dispatcher is `manual`: nothing ticks unless something
 * asks. A cron alone would then advance a run one step per minute, because each step's next
 * task is only written when the previous handler reports. `drain` closes that gap — it keeps
 * ticking, waits for the in-process handlers between passes, and stops when the outbox has
 * nothing left or the budget runs out.
 */

import { afterEach, describe, expect, it } from "vitest";
import { defineWorkflow, resultOf, sequence, step } from "../src/index.ts";
import { createClient, createHost, defineWorker, type Host } from "../src/host.ts";
import type { DrainResult } from "../src/host.ts";
import { finish, plan, work } from "./example/activities.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, sleep, type Sandbox } from "./support.ts";

const TOKEN = "drain-token";

const threeSteps = defineWorkflow(
  "drain.threeSteps",
  sequence([
    step(plan),
    step(work, (state) => ({
      item: resultOf(state, plan).items[0] ?? "",
    })),
    step(finish, (state) => ({
      uppers: [resultOf(state, work).upper],
      approvedBy: "the drain",
    })),
  ]),
);

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

async function manualHost(
  overrides: Partial<Parameters<typeof createHost>[0]> = {},
): Promise<Host> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [threeSteps],
    activities: [plan, work, finish],
    workers: [exampleWorker({ workMs: 1 }).worker],
    auth: { token: TOKEN },
    dispatcher: { mode: "manual" },
    ...overrides,
  });
  open.push({ host, box });
  await host.start();
  return host;
}

function tickRequest(query = ""): Request {
  return new Request(`http://vlo.localhost/v1/timers/tick${query}`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
  });
}

describe("Host.drain", () => {
  it("runs a three-step workflow to completion in one call", async () => {
    const host = await manualHost();
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(threeSteps, { n: 2 });

    const result = await host.drain();

    expect(result.idle).toBe(true);
    expect(result.passes).toBeGreaterThan(1);
    expect(result.counts).toMatchObject({ started: 0, pushed: 0, timers: 0, notified: 0 });

    const completed = await client.get(started.run_id);
    expect(completed.status).toBe("completed");
    expect(completed.output).toMatchObject({
      "example.finish": { report: "ITEM-0 approved by the drain" },
    });
  });

  it("stops at maxMs when a handler outlives the budget", async () => {
    const slow = defineWorker({ "example.plan": async () => {
      await sleep(400);
      return { items: ["item-0"] };
    } });
    const host = await manualHost({ workers: [slow] });
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    await client.start(threeSteps, { n: 1 });

    const at = Date.now();
    const result = await host.drain({ maxMs: 50 });

    expect(result.idle).toBe(false);
    expect(Date.now() - at).toBeLessThan(350);
  });

  it("answers the tick route with the drain result under ?drain=1", async () => {
    const host = await manualHost();
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(threeSteps, { n: 1 });

    const response = await host.fetch(tickRequest("?drain=1&max_ms=10000"));
    expect(response.status).toBe(200);
    const result = (await response.json()) as DrainResult;
    expect(result.idle).toBe(true);
    expect(result.passes).toBeGreaterThan(1);
    expect((await client.get(started.run_id)).status).toBe("completed");

    // Without the flag it is still one pass, and a bad budget is a 400 rather than a drain.
    expect(await (await host.fetch(tickRequest())).json()).toMatchObject({ started: 0 });
    expect((await host.fetch(tickRequest("?drain=1&max_ms=soon"))).status).toBe(400);
  });

  it("picks up a run created while nothing was ticking, and shares one drain between callers", async () => {
    const host = await manualHost();
    const client = createClient({ fetch: host.fetch, token: TOKEN });

    const first = await client.start(threeSteps, { n: 1 });
    expect((await host.drain()).idle).toBe(true);
    expect((await client.get(first.run_id)).status).toBe("completed");

    // Nothing drives the outbox between drains: the run sits in `created` until the next one.
    const second = await client.start(threeSteps, { n: 1 });
    await sleep(200);
    expect((await client.get(second.run_id)).status).toBe("created");

    const [a, b] = await Promise.all([host.drain(), host.drain()]);
    expect(a).toBe(b);
    expect((await client.get(second.run_id)).status).toBe("completed");
  });

  it("rejects tick and drain on a host that holds no orchestrator role", async () => {
    const host = await manualHost({ roles: ["api"] });
    await expect(host.tick()).rejects.toThrow(/orchestrator/);
    await expect(host.drain()).rejects.toThrow(/orchestrator/);
  });
});
