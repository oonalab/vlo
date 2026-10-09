/**
 * `vlo doctor` — every check is a real round trip, so these tests are too: a SQLite journal
 * and a file blob store on disk for the happy path, and a Postgres url pointing at a closed
 * port for the failure. The verb is called in process, not spawned, so the checks can be
 * asserted individually rather than scraped out of stdout.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { doctor, doctorCommand, table } from "../src/cli/doctor.ts";
import type { Check } from "../src/cli/checks.ts";

const SDK_SRC = new URL("../src/", import.meta.url).pathname;
const dirs: string[] = [];

/** The journal lives inside the project dir, so cleanup takes it with everything else. */
const sqlite = (dir: string): string => `sqlite://${join(dir, "journal.db")}`;

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** `journal` is written into the profile verbatim, so a bad url is the failure case. */
async function project(journal: (dir: string) => string, extra = ""): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-doctor-"));
  dirs.push(dir);
  await writeFile(
    join(dir, "vlo.config.ts"),
    `import { defineConfig } from "${SDK_SRC}config/define.ts";
     export default defineConfig({
       workflows: ["*.workflow.ts"],
       activities: ["activities.ts"],
       profiles: {
         local: {
           journal: "${journal(dir)}",
           blob: "file://${join(dir, "blobs")}",
           ${extra}
         },
       },
     });`,
    "utf8",
  );
  await writeFile(
    join(dir, "activities.ts"),
    `import { z } from "zod";
     import { activity } from "${SDK_SRC}index.ts";
     export const echo = activity("demo.echo", { input: z.string(), output: z.string() });`,
    "utf8",
  );
  await writeFile(
    join(dir, "demo.workflow.ts"),
    `import { cmd, defineWorkflow } from "${SDK_SRC}index.ts";
     import { echo } from "./activities.ts";
     export default defineWorkflow("demo", {
       init: () => ({}),
       on: {
         started: (s) => [s, [cmd.task(echo, "hi")]],
         task_done: (s) => [s, [cmd.complete(null)]],
       },
     });`,
    "utf8",
  );
  return dir;
}

function byName(checks: Check[], name: string): Check {
  const found = checks.find((c) => c.check === name);
  if (found === undefined) throw new Error(`no check named ${name} in ${checks.map((c) => c.check).join(", ")}`);
  return found;
}

describe("vlo doctor", () => {
  it("passes every check on a SQLite journal and a file blob store", async () => {
    const dir = await project(sqlite);

    const checks = await doctor({ cwd: dir, profile: "local" });
    expect(checks.filter((c) => c.status === "fail")).toEqual([]);

    expect(byName(checks, "journal").detail).toMatch(/^sqlite · commit round trip \d+ ms$/);
    expect(byName(checks, "migrate").status).toBe("ok");
    expect(byName(checks, "blob").detail).toMatch(/1 KiB round trip$/);
    expect(byName(checks, "kernel").detail).toMatch(/^protocol \d+ · \d+ KiB$/);
    expect(byName(checks, "queues").detail).toContain("in-process only");
    expect(byName(checks, "roles").detail).toBe("orchestrator · api · worker:* · dispatcher loop");
    // Nothing has booted this build yet, so the activity is not in `schemas` — a warning,
    // not a failure: the host upserts it on start.
    expect(byName(checks, "schemas")).toMatchObject({
      status: "warn",
      detail: "0/1 registered · missing demo.echo",
    });
  });

  it("fails the journal check when the database is unreachable, and exits 1", async () => {
    // Port 1 is never listening; pg fails fast with ECONNREFUSED.
    const dir = await project(() => "postgres://vlo:vlo@127.0.0.1:1/vlo");
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const previous = process.exitCode;

    await doctorCommand(["--profile", "local"], dir);

    expect(process.exitCode).toBe(1);
    const printed = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(printed).toContain("✗ migrate");
    expect(printed).toContain("the journal is unreachable");
    process.exitCode = previous;
  });

  it("warns instead of writing when --no-migrate is given", async () => {
    const dir = await project(sqlite);

    const checks = await doctor({ cwd: dir, profile: "local", migrate: false });
    expect(byName(checks, "migrate")).toMatchObject({ status: "warn", detail: "skipped (--no-migrate)" });
    // An unmigrated journal shows up as a failed commit round trip, not a silent pass.
    expect(byName(checks, "journal").status).toBe("fail");
  });

  it("warns when an orchestrator on a manual dispatcher has no cron to tick it", async () => {
    const dir = await project(
      sqlite,
      `roles: ["orchestrator", "api"],
       dispatcher: { mode: "manual" },
       deploy: { target: "vercel" },`,
    );

    const roles = byName(await doctor({ cwd: dir, profile: "local" }), "roles");
    expect(roles.status).toBe("warn");
    expect(roles.hint).toContain("POST /v1/timers/tick");
  });

  it("reports queue reachability and says when a push queue has no secret", async () => {
    const dir = await project(
      sqlite,
      `queues: {
         media: { url: "https://media.example/v1/tasks/push" },
         llm: { url: "https://llm.example/v1/tasks/push", secret: "s" },
         bulk: { mode: "pull" },
       },`,
    );
    const fakeFetch = vi.fn(async (input: string | URL | Request) =>
      String(input).startsWith("https://media")
        ? new Response(null, { status: 200 })
        : Promise.reject(new Error("connect ECONNREFUSED")),
    ) as unknown as typeof fetch;

    const checks = await doctor({ cwd: dir, profile: "local", fetch: fakeFetch });
    expect(byName(checks, "queue:media")).toMatchObject({
      status: "warn",
      detail: "push · https://media.example/healthz reachable · no secret",
    });
    expect(byName(checks, "queue:llm").status).toBe("fail");
    expect(byName(checks, "queue:bulk").detail).toBe("pull · served by pollers");
  });

  it("renders a table with a hint under anything that is not ✓", () => {
    const rendered = table([
      { check: "journal", status: "ok", detail: "sqlite · commit round trip 1 ms" },
      { check: "blob", status: "fail", detail: "denied", hint: "check the blob url" },
    ]);
    expect(rendered).toBe(
      "  ✓ journal  sqlite · commit round trip 1 ms\n" +
        "  ✗ blob     denied\n" +
        "             → check the blob url\n",
    );
  });
});
