/** Small helpers shared by the routes: JSON in, JSON out, bearer auth, errors. */

import { timingSafeEqual } from "node:crypto";
import type { Cause, Json, Usage } from "../../kernel/protocol.ts";
import { BadRequest, Unauthorized, VloError } from "../errors.ts";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof VloError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: { code: "internal", message } }, 500);
}

export async function readJson(request: Request): Promise<Json> {
  const text = await request.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as Json;
  } catch (error) {
    throw new BadRequest(`body is not JSON: ${error instanceof Error ? error.message : error}`);
  }
}

export function requireBearer(request: Request, token: string | undefined): void {
  if (token === undefined) return;
  if (!constantTimeEquals(request.headers.get("authorization") ?? "", `Bearer ${token}`)) {
    throw new Unauthorized();
  }
}

/** Compares without leaking the match length through timing. Length itself is not secret. */
export function constantTimeEquals(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function asObject(value: Json): Record<string, Json> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequest("body must be a JSON object");
  }
  return value;
}

export function requireString(body: Record<string, Json>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequest(`"${key}" must be a non-empty string`);
  }
  return value;
}

export function requireInt(body: Record<string, Json>, key: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequest(`"${key}" must be an integer`);
  }
  return value;
}

export function optionalInt(body: Record<string, Json>, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new BadRequest(`"${key}" must be a non-negative integer`);
  }
  return value;
}

const CAUSES: ReadonlySet<string> = new Set<Cause>([
  "timeout",
  "heartbeat_lost",
  "app_error",
  "user_cancel",
  "schema_violation",
  "nondeterminism_detected",
]);

export function optionalCause(body: Record<string, Json>): Cause | undefined {
  const value = body.cause;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !CAUSES.has(value)) throw new BadRequest(`unknown cause`);
  return value as Cause;
}

/** Wire `usage` is snake_case and integral, because the kernel hashes it into run state. */
export function optionalUsage(body: Record<string, Json>): Usage | undefined {
  const value = body.usage;
  if (value === undefined || value === null) return undefined;
  const fields = asObject(value);
  return {
    cpu_ms: optionalInt(fields, "cpu_ms") ?? 0,
    tokens: optionalInt(fields, "tokens") ?? 0,
    cost_micro_usd: optionalInt(fields, "cost_micro_usd") ?? 0,
  };
}
