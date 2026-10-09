/**
 * HTTP push: the host POSTs the task to a queue URL and the worker answers immediately with
 * an acceptance, not a result. Long work is reported later through `complete_url`.
 *
 * Status contract: `202` accepted · `200 {output}` accepted with an inline
 * result · `409` accepted, already seen · any other `4xx` the worker rejected the task
 * itself, so retrying it is pointless · `5xx`, a timeout or a socket error means "not now".
 */

import type { Json } from "../../kernel/protocol.ts";
import { signPush, ATTEMPT_HEADER, SIGNATURE_HEADER, TASK_ID_HEADER, TIMESTAMP_HEADER } from "../worker/signature.ts";
import type { PushedTask, PushResult, TaskTransport } from "./types.ts";

const TIMEOUT_MS = 5_000;

/** 4xx codes that mean "not now" rather than "never": auth, timeout, rate limit. */
const RETRYABLE_4XX: ReadonlySet<number> = new Set([401, 403, 408, 429]);

/** The subset of `fetch` the push needs; injected by tests. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Where and how to push one queue's tasks. */
export interface HttpPushOptions {
  /** The worker's push endpoint, typically `<worker base>/v1/tasks/push`. */
  url: string;
  /** HMAC secret shared with the worker. Required: an empty secret is refused. */
  secret: string;
  /** Clock for the signed timestamp, epoch milliseconds. Default `Date.now`. */
  now?: () => number;
  /** `fetch` implementation. Default `globalThis.fetch`. */
  fetch?: FetchLike;
  /** Per-push request timeout in milliseconds. Default 5 s. */
  timeoutMs?: number;
}

/** Pushes tasks to a remote worker over signed HTTP. Built by the dispatcher per configured queue. */
export class HttpPushTransport implements TaskTransport {
  /** Always `http-push`. */
  readonly kind = "http-push";
  private readonly url: string;
  private readonly secret: string;
  private readonly now: () => number;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  /** Throws a plain `Error` when `secret` is empty: tasks are never pushed unsigned. */
  constructor(options: HttpPushOptions) {
    if (!options.secret) {
      throw new Error(`queue "${options.url}" has no push secret; refusing to push unsigned tasks`);
    }
    this.url = options.url;
    this.secret = options.secret;
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  /**
   * POSTs the task with the four `vlo-*` headers. Never throws: a network error, a timeout
   * or a 5xx is `accepted: false` without `fatal`; a non-retryable 4xx sets `fatal`.
   */
  async push(task: PushedTask): Promise<PushResult> {
    const body = JSON.stringify(task);
    const tsMs = this.now();

    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [TASK_ID_HEADER]: task.task_id,
          [ATTEMPT_HEADER]: String(task.attempt),
          [TIMESTAMP_HEADER]: String(tsMs),
          [SIGNATURE_HEADER]: signPush(this.secret, task.task_id, task.attempt, tsMs, body),
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      return { accepted: false, reason: error instanceof Error ? error.message : String(error) };
    }

    if (response.status === 202 || response.status === 409) {
      await response.body?.cancel();
      return { accepted: true };
    }
    if (response.status === 200) {
      const payload = (await response.json().catch(() => null)) as { output?: Json } | null;
      return payload !== null && payload.output !== undefined
        ? { accepted: true, inlineOutput: payload.output }
        : { accepted: true };
    }

    const reason = `${response.status} ${(await response.text().catch(() => "")).slice(0, 500)}`;
    const fatal =
      response.status >= 400 && response.status < 500 && !RETRYABLE_4XX.has(response.status);
    return { accepted: false, reason, fatal };
  }
}
