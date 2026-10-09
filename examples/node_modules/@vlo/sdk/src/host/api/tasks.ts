/**
 * `/v1/tasks` — the worker-facing routes.
 *
 * `complete`, `fail` and `heartbeat` are what a worker calls back on. `push` is the other
 * direction: an inbound task for this process's worker role, authenticated by the HMAC
 * rather than the bearer token, because the pusher is a peer host and not a user.
 */

import type { HostContext } from "../context.ts";
import { Unauthorized } from "../errors.ts";
import type { PushedTask } from "../transport/types.ts";
import { completeTask, failTask, heartbeatTask } from "../worker/complete.ts";
import { handleTask } from "../worker/handle-task.ts";
import type { Worker } from "../worker/registry.ts";
import { localReporter, remoteReporter } from "../worker/reporters.ts";
import { verifySignature } from "../worker/signature.ts";
import {
  asObject,
  json,
  optionalCause,
  optionalUsage,
  readJson,
  requireInt,
  requireString,
} from "./http.ts";

export async function postComplete(
  ctx: HostContext,
  taskId: string,
  request: Request,
): Promise<Response> {
  const body = asObject(await readJson(request));
  const result = await completeTask(
    ctx,
    taskId,
    requireInt(body, "attempt"),
    body.output ?? null,
    optionalUsage(body),
  );
  return json(result);
}

export async function postFail(
  ctx: HostContext,
  taskId: string,
  request: Request,
): Promise<Response> {
  const body = asObject(await readJson(request));
  const result = await failTask(
    ctx,
    taskId,
    requireInt(body, "attempt"),
    requireString(body, "error"),
    body.retryable !== false,
    optionalCause(body) ?? "app_error",
    optionalUsage(body),
  );
  return json(result);
}

export async function postHeartbeat(
  ctx: HostContext,
  taskId: string,
  request: Request,
): Promise<Response> {
  const body = asObject(await readJson(request));
  await heartbeatTask(ctx, taskId, requireInt(body, "attempt"));
  return json({ ok: true });
}

/**
 * Inbound push. Answers 202 and runs the handler afterwards: the pusher is recording the
 * dispatch while this returns, and holding the connection open for the whole task would
 * put the lease and the socket timeout in competition.
 */
export async function postPush(
  ctx: HostContext,
  request: Request,
  inFlight: Set<string>,
): Promise<Response> {
  const secret = ctx.auth.pushSecret;
  if (secret === undefined) {
    return json({ error: { code: "no_push_secret", message: "this host accepts no pushes" } }, 503);
  }

  const raw = await request.text();
  if (!verifySignature(secret, request.headers, raw, ctx.now())) throw new Unauthorized();

  const task = JSON.parse(raw) as PushedTask;
  const worker = workerFor(ctx, task.activity.name);
  if (worker === undefined) {
    return json(
      { error: { code: "no_handler", message: `no worker serves "${task.activity.name}"` } },
      404,
    );
  }
  if (inFlight.has(task.idempotency_key)) return json({ duplicate: true }, 409);

  const reporter =
    task.complete_url !== undefined
      ? remoteReporter(task.complete_url, ctx.auth.callbackToken ?? ctx.auth.token)
      : localReporter(ctx);

  inFlight.add(task.idempotency_key);
  setImmediate(() => {
    void handleTask(worker, task, reporter).finally(() => inFlight.delete(task.idempotency_key));
  });
  return new Response(null, { status: 202 });
}

function workerFor(ctx: HostContext, activity: string): Worker | undefined {
  return ctx.workers.find(
    (w) => w.handlers.has(activity) && w.queues.some((q) => ctx.roles.has(`worker:${q}`)),
  );
}
