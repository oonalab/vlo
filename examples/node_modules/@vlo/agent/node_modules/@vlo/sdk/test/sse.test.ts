/**
 * Live run events over SSE, on a real socket.
 *
 * The socket is the point: a buffered adapter would pass every in-process test and still
 * deliver nothing until the run ended. So the assertion that matters is a timing one —
 * journal frames arrive while the run is parked on a signal, and `end` only after it is sent.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createClient, serve, type ServeResult, type StreamMessage } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { exampleWorker } from "./example/worker.ts";
import { sandbox, until, type Sandbox } from "./support.ts";

const TOKEN = "sse-token";

const open: { server: ServeResult; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.server.close();
    await entry.box.cleanup();
  }
});

async function host(): Promise<ServeResult> {
  const box = await sandbox();
  const server = await serve({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [exampleWorkflow],
    activities: [plan, work, finish],
    signals: [approve],
    workers: [exampleWorker({ workMs: 5 }).worker],
    auth: { token: TOKEN },
    dispatcher: { tickMs: 20 },
    streamPollMs: 25,
    port: 0,
  });
  open.push({ server, box });
  return server;
}

describe("sse", () => {
  it("streams journal frames while the run is live, then ends it", async () => {
    const server = await host();
    const client = createClient({ baseUrl: server.url, token: TOKEN });
    const started = await client.start(exampleWorkflow, { n: 2 });

    const messages: StreamMessage[] = [];
    const draining = (async () => {
      for await (const message of client.stream(started.run_id)) messages.push(message);
    })();

    // Frames land long before the run is over: the signal has not even been sent yet.
    await until(() => (messages.length >= 3 ? messages.length : null));
    expect(messages.every((m) => m.type === "journal")).toBe(true);
    expect((await client.get(started.run_id)).status).not.toBe("completed");

    await client.waitFor(started.run_id, "awaiting_signal");
    await client.signal(started.run_id, approve, { by: "sse" });

    await draining;
    const last = messages.at(-1);
    expect(last?.type).toBe("end");
    expect(last?.type === "end" && last.data.status).toBe("completed");

    // Every journal event, in order, exactly once.
    const seqs = messages.filter((m) => m.type === "journal").map((m) => m.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs.at(-1)).toBe((await client.get(started.run_id)).last_seq);
  });

  it("replays only what follows `since`", async () => {
    const server = await host();
    const client = createClient({ baseUrl: server.url, token: TOKEN });
    const started = await client.start(exampleWorkflow, { n: 1 });
    await client.waitFor(started.run_id, "awaiting_signal");
    await client.signal(started.run_id, approve, { by: "sse" });
    const completed = await client.waitFor(started.run_id, "completed");

    const seqs: number[] = [];
    for await (const message of client.stream(started.run_id, { since: completed.last_seq - 2 })) {
      if (message.type === "journal") seqs.push(message.seq);
    }
    expect(seqs).toEqual([completed.last_seq - 1, completed.last_seq]);
  });

  it("answers an `Accept: text/event-stream` request as a stream, and closes on abort", async () => {
    const server = await host();
    const client = createClient({ baseUrl: server.url, token: TOKEN });
    const started = await client.start(exampleWorkflow, { n: 1 });

    const response = await fetch(`${server.url}/v1/runs/${started.run_id}/events`, {
      headers: { accept: "text/event-stream", authorization: `Bearer ${TOKEN}` },
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await response.body?.cancel();

    const abort = new AbortController();
    const seen: StreamMessage[] = [];
    const draining = (async () => {
      try {
        for await (const message of client.stream(started.run_id, { signal: abort.signal })) {
          seen.push(message);
        }
      } catch {
        // Aborting mid-stream rejects the read; that is the stream closing, not a failure.
      }
    })();

    await until(() => (seen.length > 0 ? true : null));
    abort.abort();
    await draining;
    expect(seen.some((m) => m.type === "end")).toBe(false);
  });
});
