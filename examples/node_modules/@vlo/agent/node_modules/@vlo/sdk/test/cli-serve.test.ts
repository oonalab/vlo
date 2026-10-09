/**
 * `vlo serve` — the production twin of `vlo dev`.
 *
 * The verb is invoked in process (never a child) so the assertions can see the exact ✓
 * lines and the bound port. Each case gets its own project directory and its own SQLite
 * file, so nothing is shared between them but the code.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli.ts";
import { serveCommand } from "../src/cli/serve.ts";
import type { Started } from "../src/cli/bootstrap.ts";

const SDK_SRC = new URL("../src/", import.meta.url).pathname;

const dirs: string[] = [];
const running: Started[] = [];

afterEach(async () => {
  for (const started of running.splice(0)) await started.close();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  delete process.env.PORT;
  vi.restoreAllMocks();
});

async function project(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-serve-"));
  dirs.push(dir);
  await writeFile(
    join(dir, "vlo.config.ts"),
    `import { defineConfig } from "${SDK_SRC}config/define.ts";
     export default defineConfig({
       workflows: ["*.workflow.ts"],
       profiles: {
         prod: {
           journal: "sqlite://${join(dir, "journal.db")}",
           blob: "file://${join(dir, "blobs")}",
           roles: ["orchestrator", "api"],
           dispatcher: { mode: "manual" },
         },
       },
     });`,
    "utf8",
  );
  await writeFile(
    join(dir, "demo.workflow.ts"),
    `import { cmd, defineWorkflow } from "${SDK_SRC}index.ts";
     export default defineWorkflow("demo", {
       init: () => ({}),
       on: { started: (s) => [s, [cmd.complete(null)]] },
     });`,
    "utf8",
  );
  return dir;
}

/** Collects stdout instead of writing it, so the ✓ lines can be asserted on. */
function captureStdout(): { lines: () => string[] } {
  const written: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });
  return { lines: () => written.join("").split("\n").filter(Boolean) };
}

describe("vlo serve", () => {
  it("prints the same ✓ lines as dev and serves the host", async () => {
    const dir = await project();
    const stdout = captureStdout();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const started = await serveCommand(["--profile", "prod", "--port", "0"], dir);
    running.push(started);

    const lines = stdout.lines();
    expect(lines[0]).toMatch(/^ {2}✓ journal {2}sqlite:\/\//);
    expect(lines[1]).toBe("  ✓ found 1 workflow   demo");
    expect(lines[2]).toBe(`  ✓ api      http://localhost:${started.running.port}`);
    // The profile has no workers and no queues; that warning belongs on stderr.
    expect(String(stderr.mock.calls[0]?.[0])).toContain("no workers found");

    const response = await fetch(`http://127.0.0.1:${started.running.port}/healthz`);
    expect(response.ok).toBe(true);
  });

  it("listens on PORT when no --port is given", async () => {
    const dir = await project();
    captureStdout();
    process.env.PORT = "0";

    const started = await serveCommand(["--profile", "prod"], dir);
    running.push(started);
    expect(started.running.port).toBeGreaterThan(0);
  });

  it("requires a profile: there is no local default in production", async () => {
    const dir = await project();
    await expect(serveCommand([], dir)).rejects.toThrow(/--profile is required/);
  });

  it("names the profile it cannot find", async () => {
    const dir = await project();
    captureStdout();
    await expect(serveCommand(["--profile", "staging"], dir)).rejects.toThrow(/available: prod/);
  });

  it("prints usage and exits non-zero on an unknown verb", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const previous = process.exitCode;

    await main(["frobnicate"], await project());
    expect(process.exitCode).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0])).toContain("vlo serve --profile");
    process.exitCode = previous;
  });
});
