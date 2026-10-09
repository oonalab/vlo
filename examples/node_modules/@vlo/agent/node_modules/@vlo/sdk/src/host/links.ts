/**
 * Signed action links: a URL that delivers one named signal to one run, and nothing else.
 *
 * Same HMAC shape as the push signature (`worker/signature.ts`), with a different binding.
 * A push signs "this body, this attempt, now"; a link signs "this run, this signal, until
 * then" — because the holder is a person clicking an email hours later, not a peer host.
 * The token authorises exactly one `(run, signal)` pair, so leaking it cannot start a run,
 * read a journal or signal anything else.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthConfig } from "./context.ts";

const PREFIX = "v1";

/** How long a minted link stays valid when the request gives no `expires_in_ms`: 7 days. */
export const DEFAULT_LINK_TTL_MS = 7 * 24 * 60 * 60_000;

/** What a link token binds: one run, one signal, one deadline. */
export interface SignalLinkClaims {
  /** The run the signal is delivered to. */
  runId: string;
  /** The signal's name. */
  name: string;
  /** Epoch milliseconds after which the token is refused. Floored to an integer when signed. */
  expiresAtMs: number;
}

/**
 * The secret signed links are minted with. Falls back to the control-plane token and then
 * the push secret so a single-secret deployment gets links for free; `undefined` disables
 * them rather than signing with an empty key.
 */
export function linkSecret(auth: AuthConfig): string | undefined {
  return auth.linkSecret ?? auth.token ?? auth.pushSecret;
}

/**
 * Mints the token for a link: `v1.<expiresAtMs>.<hmac-sha256 hex>`. The host's
 * `POST /v1/runs/{id}/links/{name}` route does this for you; call it directly to mint
 * links out of band with the same secret ({@link linkSecret}).
 *
 * @example
 * ```ts
 * const token = signSignalLink(secret, {
 *   runId: "run_1",
 *   name: "approve",
 *   expiresAtMs: Date.now() + DEFAULT_LINK_TTL_MS,
 * });
 * verifySignalLink(secret, token, "run_1", "approve", Date.now()); // true
 * ```
 */
export function signSignalLink(secret: string, link: SignalLinkClaims): string {
  const expiresAtMs = Math.floor(link.expiresAtMs);
  return `${PREFIX}.${expiresAtMs}.${digest(secret, link.runId, link.name, expiresAtMs)}`;
}

/**
 * True when `token` was signed with `secret` for exactly this `(runId, name)` and has not
 * expired at `nowMs`. Malformed tokens are false, never thrown; the comparison is timing-safe.
 */
export function verifySignalLink(
  secret: string,
  token: string,
  runId: string,
  name: string,
  nowMs: number,
): boolean {
  const [version, expiry, signature] = token.split(".");
  if (version !== PREFIX || expiry === undefined || signature === undefined) return false;

  const expiresAtMs = Number(expiry);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;

  const expected = Buffer.from(digest(secret, runId, name, expiresAtMs), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function digest(secret: string, runId: string, name: string, expiresAtMs: number): string {
  return createHmac("sha256", secret)
    .update(`${runId}.${name}.${expiresAtMs}`, "utf8")
    .digest("hex");
}
