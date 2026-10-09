/**
 * The bit of the SSE wire format the client needs: `id`, `event` and `data` lines, one
 * dispatch per blank line. Comments (`: keepalive`) are dropped.
 *
 * Hand-rolled rather than `EventSource` because the client must send a bearer token, and
 * because this has to work identically against `host.fetch` with no socket in between.
 */

/** One SSE dispatch: the `id`, `event` and joined `data` lines. */
export interface SseFrame {
  /** The `id:` line, when present. */
  id?: string;
  /** The `event:` line, when present. */
  event?: string;
  /** Every `data:` line, joined with newlines. Empty when the frame only named an event. */
  data: string;
}

/** Yields one frame per blank-line-terminated block. Releases the reader when the consumer stops. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const frame = parseFrame(buffer.slice(0, split));
        buffer = buffer.slice(split + 2);
        if (frame !== null) yield frame;
        split = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseFrame(block: string): SseFrame | null {
  const frame: SseFrame = { data: "" };
  const data: string[] = [];

  for (const raw of block.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length === 0 || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "id") frame.id = value;
    else if (field === "event") frame.event = value;
    else if (field === "data") data.push(value);
  }

  if (data.length === 0 && frame.event === undefined) return null;
  frame.data = data.join("\n");
  return frame;
}
