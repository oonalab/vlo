/**
 * `vlo deploy` — generated templates, snapshotted.
 *
 * Snapshots are the point: these files become Terraform in a real project, so a change to
 * one should be as visible in review as a change to the Terraform itself. The last test is
 * the load-bearing one — a template that leaks a resolved secret would be a secret in git.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deploy } from "../src/cli/deploy.ts";
import type { RenderedFile } from "../src/deploy/render.ts";

const SDK_SRC = new URL("../src/", import.meta.url).pathname;
const dirs: string[] = [];

/** Resolved into the profile at load time; none of it may reach a generated file. */
const SECRETS = {
  VLO_TEST_DB: "postgres://vlo:hunter2@db.internal:5432/vlo",
  VLO_TEST_TOKEN: "tok_live_9f3c1a",
  VLO_TEST_PUSH: "whsec_2b7d40",
};

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  for (const name of Object.keys(SECRETS)) delete process.env[name];
  vi.restoreAllMocks();
});

async function project(profileBody: string): Promise<string> {
  Object.assign(process.env, SECRETS);
  const dir = await mkdtemp(join(tmpdir(), "vlo-deploy-"));
  dirs.push(dir);
  await writeFile(
    join(dir, "vlo.config.ts"),
    `import { defineConfig, env } from "${SDK_SRC}config/define.ts";
     export default defineConfig({
       workflows: ["*.workflow.ts"],
       profiles: {
         prod: {
           journal: env("VLO_TEST_DB"),
           auth: { token: env("VLO_TEST_TOKEN"), pushSecret: env("VLO_TEST_PUSH") },
           ${profileBody}
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

const CLOUD_RUN = `blob: "gcs://orbi-prod-media/vlo",
   roles: ["orchestrator", "api"],
   queues: { media: { mode: "pull" } },
   deploy: {
     target: "cloud-run",
     project: "orbi-backup",
     region: "europe-west4",
     envs: ["staging", "prod"],
   },`;

const VERCEL = `publicUrl: "https://orbiai.app",
   blob: "gcs://orbi-prod-media/vlo",
   roles: ["orchestrator", "api"],
   dispatcher: { mode: "manual" },
   queues: {
     llm: { url: env("VLO_TEST_PUSH") },
     media: { mode: "pull" },
   },
   deploy: { target: "vercel", cron: "* * * * *", bucket: "orbi-prod-media" },`;

function silence(): void {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

function contents(files: RenderedFile[], path: string): string {
  const found = files.find((f) => f.path === path);
  if (found === undefined) throw new Error(`no ${path} in ${files.map((f) => f.path).join(", ")}`);
  return found.contents;
}

describe("vlo deploy", () => {
  it("generates the cloud-run stack", async () => {
    const dir = await project(CLOUD_RUN);
    silence();

    const files = await deploy({ cwd: dir, profile: "prod" });
    expect(files.map((f) => f.path)).toEqual([
      "cloud-run/Dockerfile",
      "cloud-run/cloudbuild.yaml",
      "cloud-run/cloud-run-vlo.tf",
      "cloud-run/cloudbuild-vlo.tf",
      "cloud-run/README.md",
    ]);
    for (const file of files) expect(file.contents).toMatchSnapshot(file.path);

    // Written where `--out` says, not just returned.
    const onDisk = await readFile(join(dir, "deploy/vlo/cloud-run/cloud-run-vlo.tf"), "utf8");
    expect(onDisk).toBe(contents(files, "cloud-run/cloud-run-vlo.tf"));
  });

  it("generates the vercel stack", async () => {
    const dir = await project(VERCEL);
    silence();

    const files = await deploy({ cwd: dir, profile: "prod", out: "generated" });
    expect(files.map((f) => f.path)).toEqual([
      "vercel/route.ts",
      "vercel/vercel-crons.json",
      "vercel/env.md",
    ]);
    for (const file of files) expect(file.contents).toMatchSnapshot(file.path);

    expect(await readFile(join(dir, "generated/vercel/route.ts"), "utf8")).toContain(
      'dispatcher: { mode: "manual" }',
    );
  });

  it("omits the tick cron when the profile holds no orchestrator role", async () => {
    const dir = await project(`roles: ["api"], deploy: { target: "vercel" },`);
    silence();

    const files = await deploy({ cwd: dir, profile: "prod" });
    expect(files.map((f) => f.path)).toEqual(["vercel/route.ts", "vercel/env.md"]);
  });

  it("prints commands rather than running anything under --apply", async () => {
    const dir = await project(CLOUD_RUN);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await deploy({ cwd: dir, profile: "prod", apply: true });

    const printed = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(printed).toContain("gcloud secrets versions add vlo-prod-vlo-database-url");
    expect(printed).toContain("terraform -chdir=terraform apply");
  });

  it("says which profile has no deploy block", async () => {
    const dir = await project(`roles: ["api"],`);
    silence();
    await expect(deploy({ cwd: dir, profile: "prod" })).rejects.toThrow(/has no `deploy` block/);
  });

  it("never writes a resolved secret into a generated file", async () => {
    silence();
    const rendered = [
      ...(await deploy({ cwd: await project(CLOUD_RUN), profile: "prod" })),
      ...(await deploy({ cwd: await project(VERCEL), profile: "prod" })),
    ];

    expect(rendered.length).toBeGreaterThan(0);
    for (const file of rendered) {
      for (const secret of Object.values(SECRETS)) {
        expect(file.contents, `${file.path} leaked a secret`).not.toContain(secret);
      }
      // The pieces of the journal url matter on their own, too.
      expect(file.contents).not.toContain("hunter2");
      expect(file.contents).not.toContain("db.internal");
    }
  });
});
