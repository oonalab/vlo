/**
 * Two processes over a real socket: an orchestrator/api host that pushes, and a worker host
 * that verifies the HMAC, runs the activity and calls the result back.
 *
 * Everything here is the shipped path — `serve()`, `HttpPushTransport`, `verifySignature`,
 * `remoteReporter`. The only thing the test supplies is the pair of secrets.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createClient, serve, signPush, type ServeResult } from "../src/host.ts";
import { fakeClock } from "../src/testing.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, until, type Sandbox } from "./support.ts";

const PUSH_SECRET = "shared-hmac-secret";
const TOKEN = "control-plane-token";

const open: { servers: ServeResult[]; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    for (const server of entry.servers.reverse()) await server.close();
    await entry.box.cleanup();
  }
});

interface Pair {
  api: ServeResult;
  worker: ServeResult;
  box: Sandbox;
  activity: ReturnType<typeof exampleWorker>;
}

/** Worker first: the orchestrator needs its URL to configure the queue. */
async function pair(options: { pushSecret?: string; workMs?: number; backoffBaseMs?: number; now?: () => number } = {}): Promise<Pair> {
  const box = await sandbox();
  const activity = exampleWorker({ workMs: options.workMs ?? 5 });

  const worker = await serve({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [],
    workers: [activity.worker],
    roles: ["worker:default"],
    auth: { pushSecret: PUSH_SECRET, callbackToken: TOKEN },
    port: 0,
  });

  const api = await serve({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [exampleWorkflow],
    activities: [plan, work, finish],
    signals: [approve],
    roles: ["orchestrator", "api"],
    queues: {
      default: { url: `${worker.url}/v1/tasks/push`, secret: options.pushSecret ?? PUSH_SECRET },
    },
    auth: { token: TOKEN },
    dispatcher: { tickMs: 20, backoffBaseMs: options.backoffBaseMs ?? 1_000 },
    ...(options.now !== undefined ? { now: options.now } : {}),
    port: 0,
  });

  open.push({ servers: [worker, api], box });
  return { api, worker, box, activity };
}

describe("http push", () => {
  it("runs a workflow end to end over signed HTTP push", async () => {
    const { api, activity } = await pair();
    const client = createClient({ baseUrl: api.url, token: TOKEN });

    const started = await client.start(exampleWorkflow, { n: 2 });
    await client.waitFor(started.run_id, "awaiting_signal", 15_000);
    await client.signal(started.run_id, approve, { by: "http" });

    const completed = await client.waitFor(started.run_id, "completed", 15_000);
    expect(completed.output).toMatchObject({
      "example.finish": { report: "ITEM-0,ITEM-1 approved by http" },
    });
    expect(activity.executions().length).toBe(4);
  });

  it("refuses the control plane without a bearer token", async () => {
    const { api } = await pair();
    const response = await fetch(`${api.url}/v1/runs`, { method: "GET" });
    expect(response.status).toBe(401);
  });

  it("rejects a tampered signature and keeps re-pushing the task", async () => {
    const { api, worker, box } = await pair({ pushSecret: "the-wrong-secret", backoffBaseMs: 5 });

    // Direct proof that the worker checks the signature, independent of the dispatcher.
    const body = JSON.stringify({ task_id: "t", attempt: 1 });
    const tsMs = Date.now();
    const tampered = await fetch(`${worker.url}/v1/tasks/push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "vlo-task-id": "t",
        "vlo-attempt": "1",
        "vlo-timestamp": String(tsMs),
        "vlo-signature": signPush("not-the-secret", "t", 1, tsMs, body),
      },
      body,
    });
    expect(tampered.status).toBe(401);

    // And the dispatcher treats a 401 as "not now", not as a failed task.
    const client = createClient({ baseUrl: api.url, token: TOKEN });
    const started = await client.start(exampleWorkflow, { n: 1 });

    const journal = api.host.journal;
    const task = await until(async () => {
      const tasks = await journal.listTasks(started.run_id);
      const first = tasks[0];
      return first !== undefined && first.dispatch_attempts >= 3 ? first : null;
    });
    expect(task.status).toBe("scheduled");
    expect(task.dispatched_at_ms).toBeUndefined();

    const run = await client.get(started.run_id);
    expect(run.status).toBe("running");
    void box;
  });

  it("extends the lease on heartbeat", async () => {
    const clock = fakeClock(Date.now());
    // Long enough that the task is still running when the heartbeat lands; a finished task
    // row is closed and correctly answers 410.
    const { api } = await pair({ workMs: 10_000, now: () => clock.now() });
    const client = createClient({ baseUrl: api.url, token: TOKEN });

    const started = await client.start(exampleWorkflow, { n: 1 });
    // `plan` finishes in milliseconds and its row closes; `work` is the one still in flight.
    const running = await until(async () => {
      const tasks = await api.host.journal.listTasks(started.run_id);
      return tasks.find((t) => t.activity === work.name && t.status === "running") ?? null;
    });
    const before = running.lease_until_ms ?? 0;

    clock.advance(5_000);
    const response = await fetch(
      `${api.url}/v1/tasks/${encodeURIComponent(running.task_id)}/heartbeat`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ attempt: running.attempt }),
      },
    );
    expect(response.status).toBe(200);

    const after = await api.host.journal.getTask(running.task_id);
    expect(after?.lease_until_ms ?? 0).toBeGreaterThan(before);
  });
});
