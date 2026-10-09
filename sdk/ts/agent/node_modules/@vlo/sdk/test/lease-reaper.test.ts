/**
 * The lease reaper: a worker that stops answering loses its attempt.
 *
 * The host runs on a fake clock, so a lease expires only when the test says so — the
 * in-process transport stamps `lease_until = now + lease_ttl_ms` from that same clock when it
 * dispatches. The dispatcher still ticks on real time, so the reaper sees the jump on its
 * next pass.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, sequence, step } from "../src/index.ts";
import {
  createClient,
  createHost,
  defineWorker,
  type ActivityHandler,
  type Client,
  type Host,
} from "../src/host.ts";
import type { Envelope } from "../src/kernel/protocol.ts";
import { fakeClock, type Clock } from "../src/testing.ts";
import { sandbox, sleep, until, type Sandbox } from "./support.ts";

const T0 = 1_700_000_000_000;
const LEASE_MS = 1_000;

interface Rig {
  client: Client;
  clock: Clock;
  runId: string;
}

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

/** One host, one single-step workflow, one run already started. */
async function rig(options: {
  name: string;
  maxAttempts: number;
  handler: ActivityHandler<{ n: number }, { ok: boolean }>;
}): Promise<Rig> {
  const box = await sandbox();
  const clock = fakeClock(T0);
  const task = activity(`${options.name}.step`, {
    input: z.object({ n: z.number() }),
    output: z.object({ ok: z.boolean() }),
    leaseMs: LEASE_MS,
    // No backoff: on the fake clock a retry delay would need another advance to become due.
    retry: { maxAttempts: options.maxAttempts, initialMs: 0 },
  });
  const workflow = defineWorkflow(options.name, sequence([step(task)]));

  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [workflow],
    activities: [task],
    workers: [defineWorker({ [task.name]: options.handler })],
    now: clock.now,
    dispatcher: { tickMs: 10 },
  });
  open.push({ host, box });
  await host.start();

  const client = createClient({ fetch: host.fetch });
  const started = await client.start(workflow, { n: 1 });
  return { client, clock, runId: started.run_id };
}

/** Polls for an event, pushing the clock past one whole lease on every pass. */
function afterLeaseExpiry(rigged: Rig, match: (event: Envelope) => boolean): Promise<Envelope> {
  return until(async () => {
    rigged.clock.advance(LEASE_MS + 1);
    const events = await rigged.client.events(rigged.runId);
    return events.find(match) ?? null;
  });
}

describe("lease reaper", () => {
  it("retries a dead worker's task on a fresh attempt", async () => {
    const attempts: number[] = [];
    const rigged = await rig({
      name: "reaper.retried",
      maxAttempts: 2,
      handler: async (_input, ctx) => {
        attempts.push(ctx.attempt);
        // Attempt 1 is the worker that died: it never reports and never heartbeats again.
        if (ctx.attempt === 1) return new Promise<never>(() => {});
        return { ok: true };
      },
    });

    const retrying = await afterLeaseExpiry(
      rigged,
      (event) => event.kind === "task" && event.status === "retrying",
    );
    expect(retrying.cause).toBe("heartbeat_lost");
    expect(retrying.attempt).toBe(2);
    expect(retrying.error).toContain("lease expired");

    const completed = await rigged.client.waitFor(rigged.runId, "completed");
    expect(completed.output).toMatchObject({ "reaper.retried.step": { ok: true } });
    expect(attempts).toEqual([1, 2]);

    const succeeded = (await rigged.client.events(rigged.runId)).filter(
      (event) => event.kind === "task" && event.status === "succeeded",
    );
    expect(succeeded.map((event) => event.attempt)).toEqual([2]);
  });

  it("fails the run once the retry policy is spent", async () => {
    const rigged = await rig({
      name: "reaper.exhausted",
      maxAttempts: 1,
      handler: () => new Promise<never>(() => {}),
    });

    // The `task/failed` event is folded, the reducer throws on it, and it is rolled back with
    // its transaction — so the reaper's verdict survives on the `fail` marker instead.
    const marker = await afterLeaseExpiry(
      rigged,
      (event) => event.kind === "marker" && event.step_id === "fail",
    );
    expect(marker.error).toContain("lease expired");
    expect(JSON.parse(marker.payload ?? "null")).toMatchObject({
      kind: "task",
      status: "failed",
      cause: "heartbeat_lost",
      attempt: 1,
    });

    const view = await rigged.client.waitFor(rigged.runId, "failed");
    expect(view.status).toBe("failed");
  });

  it("leaves a worker that heartbeats on time alone", async () => {
    const running: { current?: { heartbeat: () => Promise<void>; done: () => void } } = {};
    const rigged = await rig({
      name: "reaper.alive",
      maxAttempts: 2,
      handler: (_input, ctx) =>
        new Promise<{ ok: boolean }>((resolve) => {
          running.current = { heartbeat: ctx.heartbeat, done: () => resolve({ ok: true }) };
        }),
    });

    const worker = await until(async () => running.current ?? null);

    // Two half-leases with a heartbeat in between: the lease is never behind the clock.
    rigged.clock.advance(LEASE_MS / 2);
    await worker.heartbeat();
    rigged.clock.advance(LEASE_MS / 2);
    await sleep(100);

    const events = await rigged.client.events(rigged.runId);
    expect(events.some((event) => event.kind === "task" && event.status === "retrying")).toBe(false);
    expect(events.some((event) => event.kind === "task" && event.status === "failed")).toBe(false);

    worker.done();
    await rigged.client.waitFor(rigged.runId, "completed");
  });
});
