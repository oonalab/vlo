/**
 * The two routes that make a signed link usable from an inbox.
 *
 * `POST /v1/runs/{id}/links/{name}` mints one (bearer). `GET .../signals/{name}?token=`
 * renders a confirmation page instead of delivering: a link in an email is fetched by
 * scanners and prefetchers, so a GET must never mutate. The page's form POSTs the same
 * token back, and that POST is what signals the run.
 */

import type { HostContext } from "../context.ts";
import { VloError } from "../errors.ts";
import { DEFAULT_LINK_TTL_MS, linkSecret, signSignalLink } from "../links.ts";
import { asObject, json, optionalInt, readJson } from "./http.ts";

export class LinksDisabled extends VloError {
  constructor() {
    super(
      "links_disabled",
      "signed links need auth.linkSecret (or auth.token / auth.pushSecret) on this host",
      503,
    );
  }
}

export async function postSignalLink(
  ctx: HostContext,
  request: Request,
  url: URL,
  runId: string,
  name: string,
): Promise<Response> {
  const secret = linkSecret(ctx.auth);
  if (secret === undefined) throw new LinksDisabled();

  const body = asObject(await readJson(request));
  const expiresAtMs = ctx.now() + (optionalInt(body, "expires_in_ms") ?? DEFAULT_LINK_TTL_MS);
  const token = signSignalLink(secret, { runId, name, expiresAtMs });
  const origin = (ctx.publicUrl ?? url.origin).replace(/\/$/, "");
  const base = `${origin}${ctx.basePath ?? ""}`;

  return json({
    url: `${base}${signalPath(runId, name)}?token=${encodeURIComponent(token)}`,
    expires_at_ms: expiresAtMs,
  });
}

/** The confirmation page. Deliberately dependency-free: it renders inside a webmail iframe. */
export function renderConfirmation(
  runId: string,
  name: string,
  token: string,
  basePath = "",
): Response {
  const action = `${basePath}${signalPath(runId, name)}?token=${encodeURIComponent(token)}`;
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Confirm ${escapeHtml(name)}</title>
<body style="font-family:system-ui,sans-serif;margin:0;padding:2rem;max-width:32rem">
<h1 style="font-size:1.25rem">Confirm “${escapeHtml(name)}”</h1>
<p>This sends the <code>${escapeHtml(name)}</code> signal to run <code>${escapeHtml(runId)}</code>.</p>
<form method="post" action="${escapeHtml(action)}">
<button type="submit" style="font:inherit;padding:.6rem 1.2rem">Confirm</button>
</form>
</body>
</html>
`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function signalPath(runId: string, name: string): string {
  return `/v1/runs/${encodeURIComponent(runId)}/signals/${encodeURIComponent(name)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
