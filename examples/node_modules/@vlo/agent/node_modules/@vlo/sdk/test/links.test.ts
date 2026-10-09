/**
 * Signed action links: the credential you can put in an email.
 *
 * The promise is narrow on purpose. A token authorises one signal on one run until one
 * deadline — it is not a bearer token, so it opens nothing else — and a GET with it renders
 * a form rather than delivering, because mail scanners fetch links nobody clicked.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineWorkflow, sequence, signal, waitFor } from "../src/index.ts";
import { createClient, createHost, signSignalLink, type Host } from "../src/host.ts";
import { sandbox, type Sandbox } from "./support.ts";

const TOKEN = "control-plane-token";
const LINK_SECRET = "link-secret";

// A browser form POSTs an empty body, so a link-delivered signal has to accept no payload.
const approve = signal("links.approve", z.unknown());
const parked = defineWorkflow("links.parked", sequence([waitFor(approve)]));

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

async function startHost(auth: NonNullable<Parameters<typeof createHost>[0]["auth"]>): Promise<Host> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [parked],
    signals: [approve],
    auth,
    dispatcher: { tickMs: 10 },
  });
  open.push({ host, box });
  await host.start();
  return host;
}

/** A run already parked on `approve`, plus a minted link for it. */
async function parkedRun(): Promise<{ host: Host; runId: string; url: string }> {
  const host = await startHost({ token: TOKEN, linkSecret: LINK_SECRET });
  const client = createClient({ fetch: host.fetch, token: TOKEN });
  const started = await client.start(parked, {});
  await client.waitFor(started.run_id, "awaiting_signal");
  const link = await client.signalLink(started.run_id, approve);
  return { host, runId: started.run_id, url: link.url };
}

const post = (host: Host, url: string, headers: Record<string, string> = {}): Promise<Response> =>
  host.fetch(new Request(url, { method: "POST", headers }));

describe("signed links", () => {
  it("delivers the signal on a token alone, with no bearer", async () => {
    const { host, runId, url } = await parkedRun();

    const response = await post(host, url, { "content-type": "application/json" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ delivered: true });

    const client = createClient({ fetch: host.fetch, token: TOKEN });
    await client.waitFor(runId, "completed");
    const delivered = (await client.events(runId)).find(
      (event) => event.kind === "signal" && event.status === "succeeded",
    );
    expect(delivered).toBeDefined();
  });

  it("refuses a tampered token, an expired one, and a token for another signal", async () => {
    const { host, runId, url } = await parkedRun();

    const tampered = url.replace(/token=v1\.(\d+)\./, "token=v1.$1.deadbeef");
    expect((await post(host, tampered)).status).toBe(401);

    const expired = signSignalLink(LINK_SECRET, {
      runId,
      name: approve.name,
      expiresAtMs: Date.now() - 1,
    });
    expect((await post(host, signalUrl(runId, approve.name, expired))).status).toBe(401);

    // Bound to the pair: a token minted for "reject" cannot approve.
    const elsewhere = signSignalLink(LINK_SECRET, {
      runId,
      name: "links.reject",
      expiresAtMs: Date.now() + 60_000,
    });
    expect((await post(host, signalUrl(runId, approve.name, elsewhere))).status).toBe(401);

    // And the run is still parked: nothing above got through.
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    expect((await client.get(runId)).status).toBe("awaiting_signal");
  });

  it("renders a confirmation form on GET instead of signalling", async () => {
    const { host, runId, url } = await parkedRun();

    const page = await host.fetch(new Request(url));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");

    const html = await page.text();
    const token = new URL(url).searchParams.get("token") ?? "";
    expect(html).toContain("<form method=\"post\"");
    expect(html).toContain(encodeURIComponent(token));

    // The GET itself changed nothing; the form's POST is what signals.
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    expect((await client.get(runId)).status).toBe("awaiting_signal");
    await post(host, url);
    await client.waitFor(runId, "completed");
  });

  it("keeps the bearer path working, and requires it to mint", async () => {
    const { host, runId } = await parkedRun();

    const unauthorized = await post(
      host,
      `http://vlo.localhost/v1/runs/${runId}/links/${approve.name}`,
    );
    expect(unauthorized.status).toBe(401);

    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const signalled = await client.signal(runId, approve, { by: "dc" });
    expect(signalled.delivered).toBe(true);
    await client.waitFor(runId, "completed");
  });

  it("honours expiresInMs and reports the deadline it signed", async () => {
    const host = await startHost({ token: TOKEN, linkSecret: LINK_SECRET });
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(parked, {});

    const at = Date.now();
    const link = await client.signalLink(started.run_id, approve, { expiresInMs: 60_000 });
    expect(link.expires_at_ms).toBeGreaterThanOrEqual(at + 60_000);
    expect(link.expires_at_ms).toBeLessThan(at + 61_000);
    expect(new URL(link.url).searchParams.get("token")).toMatch(/^v1\.\d+\.[0-9a-f]{64}$/);
  });

  it("falls back to the bearer token as the link secret, and refuses with no secret at all", async () => {
    const withToken = await startHost({ token: TOKEN });
    const viaToken = createClient({ fetch: withToken.fetch, token: TOKEN });
    const first = await viaToken.start(parked, {});
    await viaToken.waitFor(first.run_id, "awaiting_signal");
    const link = await viaToken.signalLink(first.run_id, approve);
    expect((await post(withToken, link.url)).status).toBe(200);

    const openHost = await startHost({});
    const anon = createClient({ fetch: openHost.fetch });
    const second = await anon.start(parked, {});
    await expect(anon.signalLink(second.run_id, approve)).rejects.toThrow("links_disabled");
  });
});

function signalUrl(runId: string, name: string, token: string): string {
  const path = `/v1/runs/${encodeURIComponent(runId)}/signals/${encodeURIComponent(name)}`;
  return `http://vlo.localhost${path}?token=${encodeURIComponent(token)}`;
}
