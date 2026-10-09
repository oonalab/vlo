/**
 * The client. Talks to a host over the `/v1` routes — or straight to `host.fetch`, with no
 * socket in between, which is what makes an end-to-end test a plain function call.
 */

import type { Envelope, Json, RunStatus } from "../kernel/protocol.ts";
import { isTerminalRunStatus } from "../core/run-status.ts";
import type { RunView } from "../host/runs.ts";
import { parseSse } from "./sse.ts";

/** Anything shaped like `fetch`. `host.fetch` is the in-process case. */
export type ClientFetch = (request: Request) => Promise<Response>;

/** How to reach a host. */
export interface ClientOptions {
  /** Absent when `fetch` is a host handler: requests still need a syntactically valid URL. */
  baseUrl?: string;
  /** Bearer token for the control plane, when the host has one. */
  token?: string;
  /** Transport. Default `globalThis.fetch`; pass `host.fetch` to skip the socket. */
  fetch?: ClientFetch;
}

/** Options for `Client.start`. */
export interface StartOptions {
  /** Caller-chosen run id. Default: host-generated. */
  runId?: string;
  /** Search attributes stored on the run. */
  search?: Record<string, Json>;
}

/** Options for `Client.startFresh`. */
export interface StartFreshOptions {
  /** The key every run of this unit of work shares; the first run's id. */
  runId: string;
  /** Search attributes stored on the run when one is started. */
  search?: Record<string, Json>;
  /** How many ended runs to walk past before giving up. Default 50. */
  maxChain?: number;
}

/** What `Client.startFresh` returns. */
export interface StartFreshResult {
  /** The run started or joined. */
  run: RunView;
  /** True when a live run under the key was joined instead of a new one started. */
  joined: boolean;
}

/** What `Client.signal` returns. */
export interface SignalResult {
  /** The stored signal's id. */
  signal_id: string;
  /** False when nothing was waiting: the signal is buffered until a wait opens. */
  delivered: boolean;
}

/** Filters for `Client.list`. */
export interface ListQuery {
  /** Status to match. */
  status?: RunStatus;
  /** Workflow name to match. */
  workflow?: string;
  /** Maximum runs. Host default 50. */
  limit?: number;
}

/** Options for `Client.signalLink`. */
export interface SignalLinkOptions {
  /** How long the link stays valid. Default 7 days. */
  expiresInMs?: number;
}

/** A minted signal link, as the host returns it. */
export interface SignalLink {
  /** Absolute URL carrying the `?token=`. */
  url: string;
  /** When the token stops working, epoch milliseconds. */
  expires_at_ms: number;
}

/** Options for `Client.stream`. */
export interface StreamOptions {
  /** Replay journal events after this seq. Default 0: from the beginning. */
  since?: number;
  /** Closes the stream when aborted. */
  signal?: AbortSignal;
}

/** One SSE frame, already decoded. `end` is the last one a stream sends. */
export type StreamMessage =
  | { type: "journal"; seq: number; data: Envelope }
  | { type: "emit"; data: { channel: string; data: Json } }
  | { type: "end"; data: RunView };

/**
 * The control-plane client. Every method maps to one `/v1` route and throws a plain `Error`
 * carrying the status and body on a non-2xx answer. Names may be passed as the definition
 * objects themselves (`activity(...)`, `signal(...)`, `defineWorkflow(...)`).
 */
export interface Client {
  /** Starts a run and returns its view once the row exists (status `created` or later). */
  start(workflow: string | { name: string }, input: Json, options?: StartOptions): Promise<RunView>;
  /** Sends a signal; buffered when the run is not waiting for it yet. */
  signal(runId: string, name: string | { name: string }, payload: Json): Promise<SignalResult>;
  /**
   * Mints a URL that delivers this one signal to this one run without a bearer token —
   * the thing you put in an email. The host signs it; opening it renders a confirmation
   * form, and submitting that form is what signals the run.
   */
  signalLink(
    runId: string,
    name: string | { name: string },
    options?: SignalLinkOptions,
  ): Promise<SignalLink>;
  /**
   * Starts a run under `runId`, or under `${runId}_2`, `_3`, … once earlier runs with the
   * key have ended: the first id with no run is started, a live one is joined. The walk is
   * deterministic, so two concurrent callers land on the same id and the insert's
   * `ON CONFLICT DO NOTHING` makes one of them the joiner.
   */
  startFresh(workflow: string | { name: string }, input: Json, options: StartFreshOptions): Promise<StartFreshResult>;
  /** The run's current view. */
  get(runId: string): Promise<RunView>;
  /** The run's current view, or `null` when the host has no such run. */
  find(runId: string): Promise<RunView | null>;
  /** Journaled events with `seq > since` (default 0). */
  events(runId: string, since?: number): Promise<Envelope[]>;
  /** Live events over SSE: journal envelopes, `cmd.emit` payloads, then one `end`. */
  stream(runId: string, options?: StreamOptions): AsyncIterable<StreamMessage>;
  /** Cancels the run and returns its view. */
  cancel(runId: string): Promise<RunView>;
  /** Runs in the host's namespace matching the query. */
  list(query?: ListQuery): Promise<RunView[]>;
  /** Polls every 50 ms until the run reaches one of `status`. Throws after `timeoutMs` (default 10 s). */
  waitFor(runId: string, status: RunStatus | readonly RunStatus[], timeoutMs?: number): Promise<RunView>;
}

const IN_PROCESS_BASE = "http://vlo.localhost";
const POLL_MS = 50;
const DEFAULT_MAX_CHAIN = 50;

/**
 * Builds a {@link Client}. With no options it talks to `http://vlo.localhost` over
 * `globalThis.fetch`, which is only useful together with `fetch: host.fetch`.
 *
 * @example
 * ```ts
 * import { createClient } from "@vlo/sdk/host";
 *
 * const client = createClient({ baseUrl: "http://127.0.0.1:4100", token: "control-plane-token" });
 * const run = await client.start(pipeline, { clip: "reel" });
 * await client.signal(run.run_id, "approve", { by: "me" });
 * const done = await client.waitFor(run.run_id, "completed");
 * console.log(done.output);
 * ```
 */
export function createClient(options: ClientOptions = {}): Client {
  const base = (options.baseUrl ?? IN_PROCESS_BASE).replace(/\/$/, "");
  const call = options.fetch ?? ((request: Request) => globalThis.fetch(request));

  async function send(method: string, path: string, body?: unknown): Promise<{ response: Response; text: string }> {
    const init: RequestInit = {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(options.token !== undefined ? { authorization: `Bearer ${options.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const response = await call(new Request(`${base}${path}`, init));
    return { response, text: await response.text() };
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { response, text } = await send(method, path, body);
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
    return (text.length > 0 ? JSON.parse(text) : null) as T;
  }

  const runPath = (runId: string): string => `/v1/runs/${encodeURIComponent(runId)}`;
  const nameOf = (name: string | { name: string }): string =>
    typeof name === "string" ? name : name.name;

  const client: Client = {
    async start(workflow, input, startOptions) {
      const { run_id } = await request<{ run_id: string }>("POST", "/v1/runs", {
        workflow: typeof workflow === "string" ? workflow : workflow.name,
        input,
        ...(startOptions?.runId !== undefined ? { run_id: startOptions.runId } : {}),
        ...(startOptions?.search !== undefined ? { search: startOptions.search } : {}),
      });
      return client.get(run_id);
    },

    signal(runId, name, payload) {
      return request<SignalResult>(
        "POST",
        `${runPath(runId)}/signals/${encodeURIComponent(nameOf(name))}`,
        payload,
      );
    },

    signalLink(runId, name, linkOptions = {}) {
      return request<SignalLink>(
        "POST",
        `${runPath(runId)}/links/${encodeURIComponent(nameOf(name))}`,
        linkOptions.expiresInMs !== undefined ? { expires_in_ms: linkOptions.expiresInMs } : {},
      );
    },

    async startFresh(workflow, input, freshOptions) {
      const maxChain = freshOptions.maxChain ?? DEFAULT_MAX_CHAIN;
      for (let n = 1; n <= maxChain; n += 1) {
        const runId = n === 1 ? freshOptions.runId : `${freshOptions.runId}_${String(n)}`;
        const existing = await client.find(runId);
        if (existing === null) {
          const run = await client.start(workflow, input, {
            runId,
            ...(freshOptions.search !== undefined ? { search: freshOptions.search } : {}),
          });
          return { run, joined: false };
        }
        if (!isTerminalRunStatus(existing.status)) return { run: existing, joined: true };
      }
      throw new Error(`startFresh: ${String(maxChain)} runs under "${freshOptions.runId}" have ended; raise maxChain`);
    },

    get: (runId) => request<RunView>("GET", runPath(runId)),

    async find(runId) {
      const { response, text } = await send("GET", runPath(runId));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GET ${runPath(runId)} → ${response.status} ${text}`);
      return JSON.parse(text) as RunView;
    },

    events: (runId, since = 0) =>
      request<Envelope[]>("GET", `${runPath(runId)}/events?since=${since}`),

    stream(runId, streamOptions = {}) {
      return streamRun(call, {
        url: `${base}${runPath(runId)}/events?stream=1&since=${streamOptions.since ?? 0}`,
        ...(options.token !== undefined ? { token: options.token } : {}),
        ...(streamOptions.signal !== undefined ? { signal: streamOptions.signal } : {}),
      });
    },

    cancel: (runId) => request<RunView>("POST", `${runPath(runId)}/cancel`, {}),

    list(query = {}) {
      const search = new URLSearchParams();
      if (query.status !== undefined) search.set("status", query.status);
      if (query.workflow !== undefined) search.set("workflow", query.workflow);
      if (query.limit !== undefined) search.set("limit", String(query.limit));
      const suffix = search.size > 0 ? `?${search.toString()}` : "";
      return request<RunView[]>("GET", `/v1/runs${suffix}`);
    },

    async waitFor(runId, status, timeoutMs = 10_000) {
      const wanted = new Set<RunStatus>(Array.isArray(status) ? status : [status as RunStatus]);
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const view = await client.get(runId);
        if (wanted.has(view.status)) return view;
        if (Date.now() >= deadline) {
          throw new Error(
            `run ${runId} is ${view.status} after ${timeoutMs}ms, waiting for ${[...wanted].join("|")}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    },
  };

  return client;
}

interface StreamRequest {
  url: string;
  token?: string;
  signal?: AbortSignal;
}

async function* streamRun(
  call: ClientFetch,
  o: StreamRequest,
): AsyncGenerator<StreamMessage, void, unknown> {
  const response = await call(
    new Request(o.url, {
      headers: {
        accept: "text/event-stream",
        ...(o.token !== undefined ? { authorization: `Bearer ${o.token}` } : {}),
      },
      ...(o.signal !== undefined ? { signal: o.signal } : {}),
    }),
  );
  if (!response.ok || response.body === null) {
    throw new Error(`GET ${o.url} → ${response.status} ${await response.text()}`);
  }

  for await (const frame of parseSse(response.body)) {
    const message = decode(frame.event, frame.data, frame.id);
    if (message !== null) yield message;
    if (message?.type === "end") return;
  }
}

function decode(event: string | undefined, data: string, id?: string): StreamMessage | null {
  switch (event) {
    case "journal":
      return { type: "journal", seq: Number(id ?? 0), data: JSON.parse(data) as Envelope };
    case "emit":
      return { type: "emit", data: JSON.parse(data) as { channel: string; data: Json } };
    case "end":
      return { type: "end", data: JSON.parse(data) as RunView };
    default:
      return null;
  }
}
