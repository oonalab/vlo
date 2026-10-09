/**
 * The manual dispatcher and its tick route.
 *
 * A serverless orchestrator has no process to hang an interval on, so the outbox must move
 * only when something outside asks it to. These tests are the proof both halves of that hold:
 * nothing happens on its own, and one HTTP call does a full pass and says what it moved.
 */

import { afterEach, describe, expect, it } from "vitest";
import { defineWorkflow, resultOf, sequence, step } from "../src/index.ts";
import { createClient, createHost, type Host, type TickCounts } from "../src/host.ts";
import { finish, plan } from "./example/activities.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, sleep, until, type Sandbox } from "./support.ts";

const TOKEN = "tick-token";

const twoSteps = defineWorkflow(
  "tick.twoSteps",
  sequence([
    step(plan),
    step(finish, (state) => ({
      uppers: resultOf(state, plan).items,
      approvedBy: "the cron",
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

async function manualHost(overrides: Partial<Parameters<typeof createHost>[0]> = {}) {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [twoSteps],
    activities: [plan, finish],
    workers: [exampleWorker({ workMs: 1 }).worker],
    auth: { token: TOKEN },
    dispatcher: { mode: "manual" },
    ...overrides,
  });
  open.push({ host, box });
  await host.start();
  return host;
}

function tickRequest(): Request {
  return new Request("http://vlo.localhost/v1/timers/tick", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}` },
  });
}

describe("manual dispatcher", () => {
  it("makes no progress until the tick route is called, then completes", async () => {
    const host = await manualHost();
    const client = createClient({ fetch: host.fetch, token: TOKEN });

    const started = await client.start(twoSteps, { n: 2 });

    // Long enough that a `loop` dispatcher would have finished the run several times over.
    await sleep(300);
    expect((await client.get(started.run_id)).status).toBe("created");
    expect(await host.journal.listTasks(started.run_id)).toHaveLength(0);

    const first = (await (await host.fetch(tickRequest())).json()) as TickCounts;
    expect(first).toMatchObject({ started: 1, pushed: 1, timers: 0, reaped: 0, notified: 0 });

    const completed = await until(async () => {
      await host.fetch(tickRequest());
      const view = await client.get(started.run_id);
      return view.status === "completed" ? view : null;
    }, 5_000);
    expect(completed.output).toMatchObject({
      "example.finish": { report: "item-0,item-1 approved by the cron" },
    });
  });

  it("refuses the tick without a bearer token, and on a host with no orchestrator", async () => {
    const host = await manualHost();
    const unauthorized = await host.fetch(
      new Request("http://vlo.localhost/v1/timers/tick", { method: "POST" }),
    );
    expect(unauthorized.status).toBe(401);

    const apiOnly = await manualHost({ roles: ["api"] });
    const response = await apiOnly.fetch(tickRequest());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "role_not_served" } });
  });
});
