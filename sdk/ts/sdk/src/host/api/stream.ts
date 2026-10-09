/**
 * `GET /v1/runs/{id}/events` as Server-Sent Events.
 *
 * The journal is the only source of truth, so the stream is a replay plus a tail: everything
 * after `since` (or `Last-Event-ID`) goes out first, then the same query runs every
 * `streamPollMs` for whatever landed since. Polling rather than listening is deliberate —
 * the events a caller cares about may be written by a different process entirely, and
 * `readEvents` is the one read both dialects already serve.
 *
 * Side-channel `cmd.emit` payloads ride the same stream as `event: emit`. They are in-memory
 * and never replayed: a reconnect resumes the journal, not the emits it missed.
 */

import type { HostContext } from "../context.ts";
import { RunNotFound } from "../errors.ts";
import { isTerminalRun } from "../events.ts";
import { getRunView } from "../runs.ts";

const KEEPALIVE_MS = 15_000;

interface EmitMessage {
  run_id: string;
  channel: string;
  data: unknown;
}

export async function streamRunEvents(
  ctx: HostContext,
  runId: string,
  url: URL,
  request: Request,
): Promise<Response> {
  const run = await ctx.journal.getRun(runId);
  if (run === null) throw new RunNotFound(runId);

  const since = sinceOf(url, request.headers);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (frame: string): void => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          open = false;
        }
      };

      const onEmit = (message: EmitMessage): void => {
        if (message.run_id !== runId) return;
        send(frame("emit", JSON.stringify({ channel: message.channel, data: message.data })));
      };
      ctx.events.on("emit", onEmit);

      const keepalive = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
      keepalive.unref();

      const finish = (): void => {
        if (!open) return;
        open = false;
        clearInterval(keepalive);
        ctx.events.off("emit", onEmit);
        try {
          controller.close();
        } catch {
          // Already closed by the peer going away.
        }
      };

      request.signal.addEventListener("abort", finish, { once: true });
      void tail(ctx, runId, since, send, () => open).finally(finish);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Tells reverse proxies not to buffer the body, which would defeat the whole thing.
      "x-accel-buffering": "no",
    },
  });
}

/** Replays from `since`, then follows the journal until the run is terminal. */
async function tail(
  ctx: HostContext,
  runId: string,
  since: number,
  send: (frame: string) => void,
  open: () => boolean,
): Promise<void> {
  let lastSeq = since;
  for (;;) {
    const events = await ctx.journal.readEvents(runId, lastSeq);
    for (const envelope of events) {
      send(frame("journal", JSON.stringify(envelope), envelope.seq));
      lastSeq = envelope.seq;
    }
    if (!open()) return;

    const run = await ctx.journal.getRun(runId);
    if (run !== null && isTerminalRun(run.status) && run.last_seq <= lastSeq) {
      send(frame("end", JSON.stringify(await getRunView(ctx, runId))));
      return;
    }
    await sleep(ctx.streamPollMs);
    if (!open()) return;
  }
}

function frame(event: string, data: string, id?: number): string {
  const head = id === undefined ? "" : `id: ${id}\n`;
  return `${head}event: ${event}\ndata: ${data}\n\n`;
}

/** `?since` wins over `Last-Event-ID`, so an explicit replay beats a reconnect. */
function sinceOf(url: URL, headers: Headers): number {
  const explicit = Number(url.searchParams.get("since"));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const resumed = Number(headers.get("last-event-id"));
  return Number.isFinite(resumed) && resumed > 0 ? resumed : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

/** True when the caller asked for a stream rather than the JSON array. */
export function wantsStream(request: Request, url: URL): boolean {
  if (url.searchParams.get("stream") === "1") return true;
  return (request.headers.get("accept") ?? "").includes("text/event-stream");
}
