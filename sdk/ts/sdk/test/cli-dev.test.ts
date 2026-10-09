/**
 * `vlo dev` profile resolution: `--profile`, then `VLO_PROFILE`, then `local`, then the
 * config's only profile. Every case here stops at config load, so no host is started.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dev } from "../src/cli/dev.ts";

const SDK_SRC = new URL("../src/", import.meta.url).pathname;
const dirs: string[] = [];

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  delete process.env.VLO_PROFILE;
});

async function project(profiles: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-dev-"));
  dirs.push(dir);
  await writeFile(
    join(dir, "vlo.config.ts"),
    `import { defineConfig } from "${SDK_SRC}config/define.ts";
     export default defineConfig({ workflows: [], profiles: {
       ${profiles.map((name) => `${name}: { journal: "sqlite://:memory:" }`).join(",\n")}
     } });`,
    "utf8",
  );
  return dir;
}

describe("vlo dev · profile", () => {
  it("asks for --profile when several profiles exist and none is `local`", async () => {
    const dir = await project(["staging", "prod"]);
    await expect(dev([], dir)).rejects.toThrow(/pass --profile; available: staging, prod/);
  });

  it("honours VLO_PROFILE before falling back", async () => {
    const dir = await project(["local", "staging"]);
    process.env.VLO_PROFILE = "missing";
    await expect(dev([], dir)).rejects.toThrow(/no profile "missing".*available: local, staging/);
  });

  it("lets --profile override VLO_PROFILE", async () => {
    const dir = await project(["local"]);
    process.env.VLO_PROFILE = "local";
    await expect(dev(["--profile", "nope"], dir)).rejects.toThrow(/no profile "nope"/);
  });
});
