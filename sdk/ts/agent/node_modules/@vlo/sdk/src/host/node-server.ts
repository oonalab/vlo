/**
 * node:http ↔ fetch adapter. The router speaks `Request`/`Response`; this is the ~80 lines
 * that let it listen on a port without pulling in a framework.
 *
 * The body is piped, never buffered: an SSE response never ends, so waiting for it would
 * hang the request instead of streaming it. A socket that goes away aborts the request
 * signal, which is how an open stream learns its reader left.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FetchHandler } from "./api/router.ts";

/** A bound `node:http` server. */
export interface Listening {
  /** `http://<host>:<port>`, with the port actually bound. */
  url: string;
  /** The port actually bound; differs from the request when `0` was asked for. */
  port: number;
  /** Closes every open connection (SSE streams included) and stops listening. */
  close(): Promise<void>;
}

/**
 * Serves a fetch-style handler on `port` (`0` picks a free one) and `host` (default
 * `127.0.0.1`). Rejects when the port cannot be bound. Response bodies are streamed, so an
 * SSE response works without a framework.
 */
export async function listen(handler: FetchHandler, port: number, host = "127.0.0.1"): Promise<Listening> {
  const server = createServer((req, res) => {
    void respond(handler, req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const actual = typeof address === "object" && address !== null ? address.port : port;
  return {
    url: `http://${host}:${actual}`,
    port: actual,
    close: () => closeServer(server),
  };
}

async function respond(
  handler: FetchHandler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const gone = new AbortController();
  res.on("close", () => gone.abort());

  try {
    const response = await handler(toRequest(req, gone.signal));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body === null) {
      res.end();
      return;
    }
    res.flushHeaders();
    await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), res);
  } catch (error) {
    // The reader hanging up mid-body is not an error worth a 500 nobody can read.
    if (res.writableEnded || res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { code: "internal", message: String(error) } }));
  }
}

function toRequest(req: IncomingMessage, signal: AbortSignal): Request {
  const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url, {
    method,
    headers: headersOf(req),
    signal,
    ...(hasBody
      ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" }
      : {}),
  } as RequestInit);
}

function headersOf(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
