/** `/v1/runs` — start, read, signal, cancel, list. */

import type { Json, RunStatus } from "../../kernel/protocol.ts";
import type { HostContext } from "../context.ts";
import { cancelRun, getRunView, listRuns, readRunEvents, signalRun, startRun } from "../runs.ts";
import { asObject, json, readJson, requireString } from "./http.ts";

export async function createRun(ctx: HostContext, request: Request): Promise<Response> {
  const body = asObject(await readJson(request));
  const started = await startRun(ctx, {
    workflow: requireString(body, "workflow"),
    input: body.input ?? null,
    ...(typeof body.run_id === "string" ? { runId: body.run_id } : {}),
    ...(isRecord(body.search) ? { search: body.search } : {}),
  });
  return json(started, 201);
}

export async function showRun(ctx: HostContext, runId: string): Promise<Response> {
  return json(await getRunView(ctx, runId));
}

export async function showEvents(
  ctx: HostContext,
  runId: string,
  url: URL,
): Promise<Response> {
  const since = Number(url.searchParams.get("since") ?? 0);
  return json(await readRunEvents(ctx, runId, Number.isFinite(since) ? since : 0));
}

export async function postSignal(
  ctx: HostContext,
  runId: string,
  name: string,
  request: Request,
): Promise<Response> {
  return json(await signalRun(ctx, runId, name, await readJson(request)));
}

export async function postCancel(ctx: HostContext, runId: string): Promise<Response> {
  return json(await cancelRun(ctx, runId));
}

export async function indexRuns(ctx: HostContext, url: URL): Promise<Response> {
  const status = url.searchParams.get("status");
  const workflow = url.searchParams.get("workflow");
  const limit = Number(url.searchParams.get("limit") ?? 50);

  return json(
    await listRuns(ctx, {
      ...(status !== null ? { status: status as RunStatus } : {}),
      ...(workflow !== null ? { workflow } : {}),
      ...(Number.isInteger(limit) && limit > 0 ? { limit } : {}),
    }),
  );
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
