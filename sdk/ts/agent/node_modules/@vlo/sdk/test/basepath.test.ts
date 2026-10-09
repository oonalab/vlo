/**
 * Mounting the host under a path prefix.
 *
 * A Next route file lives at `app/api/vlo/[[...path]]/route.ts`, so every request arrives as
 * `/api/vlo/v1/…`. The router strips the prefix before matching, and — the part that is easy
 * to forget — every URL the host hands out has to carry it back: a `complete_url` a worker
 * posts to, and a signed link a person clicks.
 */

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { activity, defineWorkflow, sequence, signal, step, waitFor } from "../src/index.ts";
import { createClient, createHost, type Host } from "../src/host.ts";
import type { PushedTask } from "../src/host.ts";
import { sandbox, type Sandbox } from "./support.ts";

const TOKEN = "base-token";
const PUBLIC_URL = "https://vlo.example";
const BASE = "/api/vlo";
const PUSH_SECRET = "push-secret";

const approve = signal("basepath.approve", z.unknown());
const parked = defineWorkflow("basepath.parked", sequence([waitFor(approve)]));

const remote = activity("basepath.remote", {
  input: z.unknown(),
  output: z.object({ done: z.boolean() }),
  queue: "remote",
});
const pushed = defineWorkflow("basepath.pushed", sequence([step(remote)]));

const open: { host: Host; box: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host.stop();
    await entry.box.cleanup();
  }
});

async function startHost(
  overrides: Partial<Parameters<typeof createHost>[0]> = {},
): Promise<Host> {
  const box = await sandbox();
  const host = createHost({
    journal: box.journalUrl,
    blob: box.blobUrl,
    workflows: [parked, pushed],
    activities: [remote],
    signals: [approve],
    auth: { token: TOKEN },
    basePath: BASE,
    publicUrl: PUBLIC_URL,
    dispatcher: { tickMs: 10 },
    ...overrides,
  });
  open.push({ host, box });
  await host.start();
  return host;
}

const get = (host: Host, path: string): Promise<Response> =>
  host.fetch(new Request(`${PUBLIC_URL}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } }));

describe("basePath", () => {
  it("serves the routes under the mount path, and still answers an in-process client", async () => {
    const host = await startHost();

    const health = await get(host, `${BASE}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });

    const created = await host.fetch(
      new Request(`${PUBLIC_URL}${BASE}/v1/runs`, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ workflow: parked.name, input: {} }),
      }),
    );
    expect(created.ok).toBe(true);
    const { run_id: runId } = (await created.json()) as { run_id: string };
    expect((await (await get(host, `${BASE}/v1/runs/${runId}`)).json())).toMatchObject({
      run_id: runId,
    });

    // Anything under the prefix that is not a route is still a 404, not a silent match.
    expect((await get(host, `${BASE}/nope`)).status).toBe(404);

    // The in-process client addresses `/v1/…` with no prefix; a path that does not carry
    // the base is matched as it stands, so `createClient({ fetch: host.fetch })` keeps working.
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(parked, {});
    expect((await client.get(started.run_id)).workflow).toBe(parked.name);
  });

  it("puts the base path into complete_url on a push", async () => {
    const pushes: PushedTask[] = [];
    const host = await startHost({
      workflows: [pushed],
      queues: { remote: { url: "https://worker.example/tasks", secret: PUSH_SECRET } },
      dispatcher: {
        mode: "manual",
        fetch: async (_url, init) => {
          pushes.push(JSON.parse(String(init.body)) as PushedTask);
          return new Response(null, { status: 202 });
        },
      },
    });

    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(pushed, {});
    await host.tick();

    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.run_id).toBe(started.run_id);
    expect(pushes[0]?.complete_url).toBe(
      `${PUBLIC_URL}${BASE}/v1/tasks/${encodeURIComponent(pushes[0]?.task_id ?? "")}`,
    );
  });

  it("mints a signal link under the base path, and the link round-trips", async () => {
    const host = await startHost();
    const client = createClient({ fetch: host.fetch, token: TOKEN });
    const started = await client.start(parked, {});
    await client.waitFor(started.run_id, "awaiting_signal");

    const link = await client.signalLink(started.run_id, approve);
    expect(link.url.startsWith(`${PUBLIC_URL}${BASE}/v1/runs/`)).toBe(true);

    // The confirmation form posts back to the mounted path, not to the bare route.
    const page = await host.fetch(new Request(link.url));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(`action="${BASE}/v1/runs/`);

    const delivered = await host.fetch(new Request(link.url, { method: "POST" }));
    expect(delivered.status).toBe(200);
    await client.waitFor(started.run_id, "completed");
  });
});
