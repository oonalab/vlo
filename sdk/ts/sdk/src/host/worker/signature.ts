/**
 * Push signatures. Same shape as the repo's Zernio webhook verifier: HMAC-SHA256, hex,
 * compared timing-safe — but the signed string binds the task and a timestamp as well as
 * the body, so a captured push cannot be replayed onto a different attempt or an hour later.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying the pushed task's id. */
export const TASK_ID_HEADER = "vlo-task-id";
/** Header carrying the attempt number. */
export const ATTEMPT_HEADER = "vlo-attempt";
/** Header carrying the signing time, epoch milliseconds. */
export const TIMESTAMP_HEADER = "vlo-timestamp";
/** Header carrying the signature, `v1=<hex>`. */
export const SIGNATURE_HEADER = "vlo-signature";

const PREFIX = "v1=";
const WINDOW_MS = 5 * 60_000;

function digest(secret: string, taskId: string, attempt: number, tsMs: number, body: string): string {
  const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
  return createHmac("sha256", secret)
    .update(`${taskId}.${attempt}.${tsMs}.${bodyHash}`, "utf8")
    .digest("hex");
}

/**
 * Signs a push: `v1=` + HMAC-SHA256 over `taskId.attempt.tsMs.sha256(body)`, hex. The
 * dispatcher's HTTP transport calls this; a custom transport signs the same way.
 */
export function signPush(
  secret: string,
  taskId: string,
  attempt: number,
  tsMs: number,
  body: string,
): string {
  return PREFIX + digest(secret, taskId, attempt, tsMs, body);
}

/** Anything with `Headers.get` semantics. */
export interface HeaderSource {
  /** The header's value, or null when absent. */
  get(name: string): string | null;
}

/**
 * True when the `vlo-*` headers sign `rawBody` with `secret` and the timestamp is within
 * 5 minutes of `nowMs` (default `Date.now()`). Missing or malformed headers are false, never
 * thrown; the comparison is timing-safe.
 */
export function verifySignature(
  secret: string,
  headers: HeaderSource,
  rawBody: string,
  nowMs: number = Date.now(),
): boolean {
  const taskId = headers.get(TASK_ID_HEADER);
  const attempt = Number(headers.get(ATTEMPT_HEADER));
  const tsMs = Number(headers.get(TIMESTAMP_HEADER));
  const signature = headers.get(SIGNATURE_HEADER);

  if (taskId === null || signature === null) return false;
  if (!Number.isInteger(attempt) || !Number.isFinite(tsMs)) return false;
  if (Math.abs(nowMs - tsMs) > WINDOW_MS) return false;

  const expected = Buffer.from(signPush(secret, taskId, attempt, tsMs, rawBody), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
