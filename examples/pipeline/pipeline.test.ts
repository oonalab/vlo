/** A whole run on the real engine: a throwaway SQLite journal, and `host.fetch` instead of a socket. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, createHost, type Host } from "@oona/vlo/host";
import { afterEach, expect, it } from "vitest";
import { approve, finish, plan, work } from "./activities.ts";
import worker from "./pipeline.worker.ts";
import pipeline from "./pipeline.workflow.ts";

let host: Host;
let dir: string;

afterEach(async () => {
  await host.stop();
  await rm(dir, { recursive: true, force: true });
});

it("waits for approval, then finishes", async () => {
  dir = await mkdtemp(join(tmpdir(), "vlo-test-"));
  host = createHost({
    journal: `sqlite://${join(dir, "journal.db")}`,
    blob: `file://${join(dir, "blobs")}`,
    workflows: [pipeline],
    activities: [plan, work, finish],
    signals: [approve],
    workers: [worker],
    dispatcher: { tickMs: 10 },
  });
  await host.start();
  const client = createClient({ fetch: host.fetch });

  const run = await client.start(pipeline, { n: 3 });
  await client.waitFor(run.run_id, "awaiting_signal");

  await client.signal(run.run_id, approve, { by: "test" });
  const done = await client.waitFor(run.run_id, "completed");

  expect(done.output).toMatchObject({
    "pipeline.finish": { report: "ITEM-0,ITEM-1,ITEM-2 approved by test" },
  });
});
