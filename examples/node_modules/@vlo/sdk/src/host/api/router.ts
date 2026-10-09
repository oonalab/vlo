/**
 * The host's HTTP surface, as a plain `(Request) => Response` so it drops into Node, a Next
 * route file or a test with no adapter in between.
 *
 * Auth has three shapes. The control plane takes a bearer token when one is configured. The
 * inbound push takes an HMAC instead: the caller is a peer host, it already shares the queue
 * secret, and it signs the body rather than presenting a user credential. The signal route
 * additionally accepts a signed link token, which authorises that one `(run, signal)` pair
 * and nothing else — the credential a person can be handed in an email.
 */

import type { HostContext } from "../context.ts";
import type { DrainOptions } from "../drain.ts";
import { BadRequest, VloError } from "../errors.ts";
import { linkSecret, verifySignalLink } from "../links.ts";
import { errorResponse, json, requireBearer } from "./http.ts";
import { postSignalLink, renderConfirmation } from "./links.ts";
import { postPoll } from "./poll.ts";
import { createRun, indexRuns, postCancel, postSignal, showEvents, showRun } from "./runs.ts";
import { streamRunEvents, wantsStream } from "./stream.ts";
import { postComplete, postFail, postHeartbeat, postPush } from "./tasks.ts";

/** A fetch-style request handler: what `Host.fetch`, `handler()` and `listen()` all speak. */
export type FetchHandler = (request: Request) => Promise<Response>;

class NotServed extends VloError {
  constructor(role: string) {
    super("role_not_served", `this host does not hold the "${role}" role`, 404);
  }
}

class NoRoute extends VloError {
  constructor(method: string, path: string) {
    super("no_route", `${method} ${path} is not a route`, 404);
  }
}

/** `"api/vlo"`, `"/api/vlo/"` and `"/api/vlo"` all normalise to `"/api/vlo"`; `""` to none. */
export function normalizeBasePath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed.length === 0 ? undefined : `/${trimmed}`;
}

/**
 * Builds the `/v1` router for a context. Every {@link VloError} becomes a JSON error response
 * with its status; anything else is a 500. Routes a role is not held for answer 404
 * `role_not_served`. `createHost` calls this; only custom hosts need it directly.
 */
export function createRouter(ctx: HostContext): FetchHandler {
  /** Idempotency keys this process is running right now, for the push endpoint. */
  const inFlight = new Set<string>();

  return async (request) => {
    try {
      return await route(ctx, request, inFlight);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

async function route(
  ctx: HostContext,
  request: Request,
  inFlight: Set<string>,
): Promise<Response> {
  const url = new URL(request.url);
  const path = stripBase(
    url.pathname.split("/").filter(Boolean).map(decodeURIComponent),
    ctx.basePath,
  );
  const method = request.method.toUpperCase();

  if (path[0] === "healthz") {
    return json({ ok: true, roles: [...ctx.roles], workflows: [...ctx.workflows.keys()] });
  }
  if (path[0] !== "v1") throw new NoRoute(method, url.pathname);

  // Signed, not bearer-authenticated: the pusher is a peer host.
  if (path[1] === "tasks" && path[2] === "push" && path.length === 3) {
    if (method !== "POST") throw new NoRoute(method, url.pathname);
    if (![...ctx.roles].some((role) => role.startsWith("worker:"))) throw new NotServed("worker");
    return postPush(ctx, request, inFlight);
  }

  // A valid link token stands in for the bearer, on that one run's one signal.
  const signed = signedSignalRoute(ctx, request, url, method, path);
  if (signed !== null) return signed;

  requireBearer(request, ctx.auth.token);

  // The cron's entry point. It belongs to the orchestrator, not the control plane, so a
  // process that serves only the API answers 404 rather than pretending to have ticked.
  if (path[1] === "timers" && path[2] === "tick" && path.length === 3) {
    if (method !== "POST") throw new NoRoute(method, url.pathname);
    if (!ctx.roles.has("orchestrator") || ctx.tick === undefined || ctx.drain === undefined) {
      throw new NotServed("orchestrator");
    }
    // `?drain=1` keeps ticking until the outbox is idle (optionally `&max_ms=`), which is
    // how one invocation carries a chain of in-process steps to its end.
    if (!truthy(url.searchParams.get("drain"))) return json(await ctx.tick());
    return json(await ctx.drain(drainOptions(url)));
  }

  if (!ctx.roles.has("api")) throw new NotServed("api");

  if (path[1] === "tasks" && path[2] === "poll" && path.length === 3) {
    if (method !== "POST") throw new NoRoute(method, url.pathname);
    return postPoll(ctx, request);
  }
  if (path[1] === "runs") return runRoute(ctx, request, url, method, path);
  if (path[1] === "tasks") return taskRoute(ctx, request, method, path);
  throw new NoRoute(method, url.pathname);
}

/**
 * `?token=` on the signal route, or null when this is not that route or the token is absent.
 * An invalid or expired token falls through to the bearer check, so a stale link gets the
 * same 401 as no credential at all rather than leaking that the run exists.
 */
function signedSignalRoute(
  ctx: HostContext,
  request: Request,
  url: URL,
  method: string,
  path: string[],
): Promise<Response> | null {
  const [, section, runId, action, name] = path;
  if (section !== "runs" || action !== "signals" || runId === undefined || name === undefined) {
    return null;
  }
  const token = url.searchParams.get("token");
  const secret = linkSecret(ctx.auth);
  if (token === null || secret === undefined) return null;
  if (!verifySignalLink(secret, token, runId, name, ctx.now())) return null;
  if (!ctx.roles.has("api")) throw new NotServed("api");

  // GET never mutates: an email client that prefetches the link gets the form, not the signal.
  if (method === "GET") {
    return Promise.resolve(renderConfirmation(runId, name, token, ctx.basePath ?? ""));
  }
  if (method === "POST") return postSignal(ctx, runId, name, request);
  throw new NoRoute(method, url.pathname);
}

function runRoute(
  ctx: HostContext,
  request: Request,
  url: URL,
  method: string,
  path: string[],
): Promise<Response> {
  const [, , runId, action, name] = path;

  if (runId === undefined) {
    if (method === "POST") return createRun(ctx, request);
    if (method === "GET") return indexRuns(ctx, url);
    throw new NoRoute(method, url.pathname);
  }
  if (action === undefined && method === "GET") return showRun(ctx, runId);
  if (action === "events" && method === "GET") {
    return wantsStream(request, url)
      ? streamRunEvents(ctx, runId, url, request)
      : showEvents(ctx, runId, url);
  }
  if (action === "cancel" && method === "POST") return postCancel(ctx, runId);
  if (action === "signals" && name !== undefined && method === "POST") {
    return postSignal(ctx, runId, name, request);
  }
  if (action === "links" && name !== undefined && method === "POST") {
    return postSignalLink(ctx, request, url, runId, name);
  }
  throw new NoRoute(method, url.pathname);
}

/**
 * Drops the mount prefix so the routes below are written as `/v1/…` whatever the host is
 * mounted under. A path that does not carry the prefix is matched as it stands, which is
 * what lets an in-process client call `/v1/runs` on a host mounted at `/api/vlo`.
 */
function stripBase(path: string[], basePath: string | undefined): string[] {
  if (basePath === undefined) return path;
  const base = basePath.slice(1).split("/");
  if (base.some((segment, at) => path[at] !== segment)) return path;
  return path.slice(base.length);
}

function truthy(value: string | null): boolean {
  return value !== null && value !== "0" && value !== "false";
}

function drainOptions(url: URL): DrainOptions {
  const raw = url.searchParams.get("max_ms");
  if (raw === null) return {};
  const maxMs = Number(raw);
  if (!Number.isInteger(maxMs) || maxMs <= 0) {
    throw new BadRequest(`"max_ms" must be a positive integer`);
  }
  return { maxMs };
}

function taskRoute(
  ctx: HostContext,
  request: Request,
  method: string,
  path: string[],
): Promise<Response> {
  const [, , taskId, action] = path;
  if (taskId === undefined || method !== "POST") throw new NoRoute(method, path.join("/"));

  switch (action) {
    case "complete":
      return postComplete(ctx, taskId, request);
    case "fail":
      return postFail(ctx, taskId, request);
    case "heartbeat":
      return postHeartbeat(ctx, taskId, request);
    default:
      throw new NoRoute(method, path.join("/"));
  }
}
