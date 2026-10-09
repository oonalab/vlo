/**
 * `vlo.config.ts` loading: profiles, environment references, and module discovery.
 *
 * The config is a real module, so it is written to disk and imported rather than mocked.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defineConfig, env, loadConfig } from "../src/config/index.ts";

const SDK_SRC = new URL("../src/", import.meta.url).pathname;
const dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  delete process.env.VLO_TEST_JOURNAL;
});

async function project(config: string, files: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-config-"));
  dirs.push(dir);
  await writeFile(join(dir, "vlo.config.ts"), config, "utf8");
  for (const [name, source] of Object.entries(files)) {
    await writeFile(join(dir, name), source, "utf8");
  }
  return dir;
}

describe("defineConfig", () => {
  it("rejects a config with no profiles", () => {
    expect(() => defineConfig({ workflows: "*.ts", profiles: {} })).toThrow(/at least one profile/);
  });

  it("records the variable name rather than its value", () => {
    expect(env("DATABASE_URL")).toEqual({ __env: "DATABASE_URL" });
  });
});

describe("loadConfig", () => {
  it("falls back to a local SQLite profile when there is no config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlo-config-"));
    dirs.push(dir);

    const loaded = await loadConfig(dir, "local");
    expect(loaded.configPath).toBeUndefined();
    expect(loaded.root).toBe(dir);
    expect(loaded.profile.journal).toBe(`sqlite://${join(dir, ".vlo/dev.db")}`);
    expect(loaded.profile.blob).toBe(`file://${join(dir, ".vlo/blobs")}`);
    expect(loaded.workflows).toHaveLength(0);
  });

  describe("implicit profile", () => {
    const withProfiles = (names: string[]) =>
      project(
        `import { defineConfig } from "${SDK_SRC}config/define.ts";
         export default defineConfig({ workflows: [], profiles: {
           ${names.map((name) => `${name}: { journal: "sqlite://${name}.db" }`).join(",\n")}
         } });`,
      );

    it("prefers `local` when the config has one", async () => {
      const dir = await withProfiles(["staging", "local"]);
      const { profile } = await loadConfig(dir, undefined, undefined, { implicitProfile: true });
      expect(profile.name).toBe("local");
    });

    it("takes the only profile when there is exactly one", async () => {
      const dir = await withProfiles(["dev"]);
      const { profile } = await loadConfig(dir, undefined, undefined, { implicitProfile: true });
      expect(profile.name).toBe("dev");
    });

    it("asks for --profile when several exist and none is `local`", async () => {
      const dir = await withProfiles(["staging", "prod"]);
      await expect(
        loadConfig(dir, undefined, undefined, { implicitProfile: true }),
      ).rejects.toThrow(/pass --profile; available: staging, prod/);
    });

    it("never guesses unless asked to", async () => {
      const dir = await withProfiles(["local"]);
      await expect(loadConfig(dir, undefined)).rejects.toThrow(/pass --profile; available: local/);
    });
  });

  describe("config-relative urls", () => {
    async function resolved(journal: string, blob: string): Promise<{ dir: string; journal: string; blob: string }> {
      const dir = await project(
        `import { defineConfig } from "${SDK_SRC}config/define.ts";
         export default defineConfig({ workflows: [], profiles: {
           x: { journal: ${JSON.stringify(journal)}, blob: ${JSON.stringify(blob)} },
         } });`,
      );
      // Loaded from a different cwd: `--config` points at the file, the root is its directory.
      const { profile, root } = await loadConfig(tmpdir(), "x", join(dir, "vlo.config.ts"));
      expect(root).toBe(dir);
      return { dir, journal: profile.journal, blob: profile.blob };
    }

    it("absolutizes bare relative paths against the config directory", async () => {
      const { dir, journal, blob } = await resolved("sqlite://.vlo/x.db", "file://.vlo/blobs");
      expect(journal).toBe(`sqlite://${join(dir, ".vlo/x.db")}`);
      expect(blob).toBe(`file://${join(dir, ".vlo/blobs")}`);
    });

    it("absolutizes ./-prefixed relative paths the same way", async () => {
      const { dir, journal, blob } = await resolved("sqlite://./.vlo/x.db", "file://./blobs");
      expect(journal).toBe(`sqlite://${join(dir, ".vlo/x.db")}`);
      expect(blob).toBe(`file://${join(dir, "blobs")}`);
    });

    it("leaves :memory:, absolute paths and other schemes untouched", async () => {
      expect(await resolved("sqlite://:memory:", "file:///var/blobs")).toMatchObject({
        journal: "sqlite://:memory:",
        blob: "file:///var/blobs",
      });
      expect(await resolved("sqlite:///abs/x.db", "gcs://bucket/prefix")).toMatchObject({
        journal: "sqlite:///abs/x.db",
        blob: "gcs://bucket/prefix",
      });
      expect((await resolved("postgres://example/db", "gcs://bucket")).journal).toBe(
        "postgres://example/db",
      );
    });
  });

  it("resolves env references and discovers workflows, workers and activities", async () => {
    process.env.VLO_TEST_JOURNAL = "postgres://example/db";

    const dir = await project(
      `import { defineConfig, env } from "${SDK_SRC}config/define.ts";
       export default defineConfig({
         workflows: ["*.workflow.ts"],
         workers: ["*.worker.ts"],
         activities: ["activities.ts"],
         profiles: {
           prod: {
             journal: env("VLO_TEST_JOURNAL"),
             auth: { token: env("VLO_MISSING_TOKEN", { optional: true }) },
             queues: { default: { url: "https://worker.example/v1/tasks/push", secret: "s" } },
             port: 8080,
           },
         },
       });`,
      {
        "activities.ts": `import { z } from "zod";
          import { activity } from "${SDK_SRC}index.ts";
          export const echo = activity("demo.echo", { input: z.string(), output: z.string() });`,
        "demo.workflow.ts": `import { cmd, defineWorkflow } from "${SDK_SRC}index.ts";
          import { echo } from "./activities.ts";
          export default defineWorkflow("demo", {
            init: () => ({}),
            on: {
              started: (s) => [s, [cmd.task(echo, "hi")]],
              task_done: (s) => [s, [cmd.complete(null)]],
            },
          });`,
        "demo.worker.ts": `import { defineWorker } from "${SDK_SRC}host.ts";
          export default defineWorker({ "demo.echo": (input: string) => input });`,
      },
    );

    const loaded = await loadConfig(dir, "prod");
    expect(loaded.profile.journal).toBe("postgres://example/db");
    expect(loaded.profile.auth.token).toBeUndefined();
    expect(loaded.profile.port).toBe(8080);
    expect(loaded.profile.queues.default?.secret).toBe("s");
    expect(loaded.workflows.map((w) => w.name)).toEqual(["demo"]);
    expect(loaded.activities.map((a) => a.name)).toEqual(["demo.echo"]);
    expect(loaded.workers).toHaveLength(1);
  });

  it("names the variable that is missing", async () => {
    const dir = await project(
      `import { defineConfig, env } from "${SDK_SRC}config/define.ts";
       export default defineConfig({
         workflows: [],
         profiles: { prod: { journal: env("VLO_DEFINITELY_UNSET") } },
       });`,
    );

    await expect(loadConfig(dir, "prod")).rejects.toThrow(/VLO_DEFINITELY_UNSET/);
  });

  it("resolves roles, dispatcher mode, publicUrl and the deploy block", async () => {
    process.env.VLO_TEST_JOURNAL = "postgres://example/db";

    const dir = await project(
      `import { defineConfig, env } from "${SDK_SRC}config/define.ts";
       export default defineConfig({
         workflows: [],
         profiles: {
           prod: {
             journal: env("VLO_TEST_JOURNAL"),
             publicUrl: "https://vlo.example",
             roles: ["orchestrator", "api"],
             dispatcher: { mode: "manual", tickMs: 250 },
             deploy: {
               target: "cloud-run",
               project: env("VLO_TEST_JOURNAL"),
               region: "europe-west4",
               envs: ["prod"],
             },
           },
         },
       });`,
    );

    const { profile } = await loadConfig(dir, "prod");
    expect(profile.roles).toEqual(["orchestrator", "api"]);
    expect(profile.dispatcher).toEqual({ mode: "manual", tickMs: 250 });
    expect(profile.publicUrl).toBe("https://vlo.example");
    expect(profile.deploy).toEqual({
      target: "cloud-run",
      project: "postgres://example/db",
      region: "europe-west4",
      envs: ["prod"],
    });
  });

  it("still accepts the legacy `host` field as the public url", async () => {
    const dir = await project(
      `import { defineConfig } from "${SDK_SRC}config/define.ts";
       export default defineConfig({
         workflows: [],
         profiles: { prod: { journal: "sqlite://x.db", host: "https://legacy.example" } },
       });`,
    );

    expect((await loadConfig(dir, "prod")).profile.publicUrl).toBe("https://legacy.example");
  });

  it("lists the profiles it knows when asked for one it does not", async () => {
    const dir = await project(
      `import { defineConfig } from "${SDK_SRC}config/define.ts";
       export default defineConfig({ workflows: [], profiles: { local: { journal: "sqlite://x.db" } } });`,
    );

    await expect(loadConfig(dir, "staging")).rejects.toThrow(/available: local/);
  });
});
