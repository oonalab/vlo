/**
 * Pull queues: the host stops pushing and a worker comes asking instead.
 *
 * Two promises are under test. The dispatcher leaves a pull queue completely alone — not
 * "tries and defers", which would burn dispatch attempts and eventually look like a fault —
 * and a `runPullWorker` on the other side of a socket finishes the run through the same
 * complete/fail/heartbeat verbs a pushed worker uses.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, sequence, step } from "../src/index.ts";
import {
  createClient,
  defineWorker,
  runPullWorker,
  serve,
  type ServeResult,
} from "../src/host.ts";
import { sandbox, sleep, until, type Sandbox } from "./support.ts";

const TOKEN = "pull-token";

const render = activity("pull.render", {
  input: z.object({ clip: z.string() }),
  output: z.object({ rendered: z.string() }),
  queue: "media",
});

const pipeline = defineWorkflow("pull.pipeline", sequence([step(render)]));

const mediaWorker = defineWorker(
  { "pull.render": (input: { clip: string }) => ({ rendered: input.clip.toUpperCase() }) },
  { queues: ["media"] },
);

const open: { server: ServeResult; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.server.close();
    await entry.box.cleanup();
  }
});

/** An orchestrator + api host that serves `media` to pollers and runs no worker itself. */
async function host(): Promise<ServeResult> {
  const box = await sandbox();
  const server = await serve({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [pipeline],
    activities: [render],
    queues: { media: { mode: "pull" } },
    auth: { token: TOKEN },
    dispatcher: { tickMs: 20 },
    port: 0,
  });
  open.push({ server, box });
  return server;
}

describe("pull mode", () => {
  it("never pushes a pull queue's tasks", async () => {
    const server = await host();
    const client = createClient({ baseUrl: server.url, token: TOKEN });
    const started = await client.start(pipeline, { clip: "reel" });

    const task = await until(async () => {
      const tasks = await server.host.journal.listTasks(started.run_id);
      return tasks[0] ?? null;
    });

    // Many ticks later the row is untouched: not claimed, so not even a deferred dispatch.
    await sleep(200);
    const after = await server.host.journal.getTask(task.task_id);
    expect(after?.status).toBe("scheduled");
    expect(after?.dispatch_attempts).toBe(0);
    expect(after?.dispatched_at_ms).toBeUndefined();
    expect((await client.get(started.run_id)).status).toBe("running");
  });

  it("completes the run through a polling worker, and stops on abort", async () => {
    const server = await host();
    const client = createClient({ baseUrl: server.url, token: TOKEN });

    const abort = new AbortController();
    const errors: unknown[] = [];
    const loop = runPullWorker({
      baseUrl: server.url,
      token: TOKEN,
      worker: mediaWorker,
      queues: ["media"],
      waitMs: 5_000,
      signal: abort.signal,
      onError: (error) => errors.push(error),
    });

    // The poll is already open when the task is written: the host wakes it rather than
    // letting it sit out the full `waitMs`.
    const at = Date.now();
    const started = await client.start(pipeline, { clip: "reel" });
    const completed = await client.waitFor(started.run_id, "completed");
    expect(Date.now() - at).toBeLessThan(4_000);
    expect(completed.output).toMatchObject({ "pull.render": { rendered: "REEL" } });

    // Handed out once, by the poller rather than by the push stage, and closed on completion.
    const task = (await server.host.journal.listTasks(started.run_id))[0];
    expect(task?.dispatch_attempts).toBe(1);
    expect(task?.status).toBe("succeeded");
    expect(task?.worker_id).toBeDefined();
    expect(task?.dispatched_at_ms).toBeDefined();

    abort.abort();
    await loop;
    expect(errors).toEqual([]);
  });
});
