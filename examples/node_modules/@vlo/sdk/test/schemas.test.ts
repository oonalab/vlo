/**
 * Schema registration is automatic: every activity and signal the host
 * knows about lands in `schemas` on boot, keyed by content hash.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createHost, type Host } from "../src/host.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";
import { sandbox, type Sandbox } from "./support.ts";

const open: { host?: Host; box?: Sandbox }[] = [];

afterEach(async () => {
  for (const entry of open.splice(0)) {
    await entry.host?.stop();
    await entry.box?.cleanup();
  }
});

describe("schema registry", () => {
  it("upserts every registered activity and signal on boot, keyed by hash", async () => {
    const box = await sandbox();
    const host = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [exampleWorkflow],
      activities: [plan, work, finish],
      signals: [approve],
    });
    open.push({ host, box });
    await host.start();

    const rows = await host.journal.transaction(async (tx) => ({
      plan: await tx.getSchema(plan.name, plan.hash),
      approve: await tx.getSchema(approve.name, approve.hash),
      missing: await tx.getSchema(plan.name, "0000000000000000"),
    }));

    expect(rows.plan?.json_schema).toBe(JSON.stringify(plan.jsonSchema));
    expect(rows.plan?.retry_policy).toBe(JSON.stringify(plan.retry));
    expect(rows.approve?.json_schema).toBe(JSON.stringify(approve.jsonSchema));
    expect(rows.missing).toBeNull();

    // A second boot on the same journal is a no-op, not a conflict.
    await host.stop();
    const again = createHost({
      journal: box.journalUrl,
      blob: box.blobUrl,
      workflows: [exampleWorkflow],
      activities: [plan],
    });
    open.push({ host: again });
    await expect(again.start()).resolves.toBeUndefined();
  });
});
