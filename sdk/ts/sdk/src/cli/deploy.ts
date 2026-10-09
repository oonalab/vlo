/**
 * `vlo deploy` — write the platform templates for a profile, and stop there.
 *
 * Generation is not application. The files land in `--out` for review and commit; `--apply`
 * prints the exact `gcloud` / `terraform` / `vercel` commands rather than running them, so
 * the thing that touches a cloud account is always a human with credentials.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "../config/load.ts";
import { commands, planDeploy, render, type RenderedFile } from "../deploy/render.ts";
import { requireProfile } from "./help.ts";

export const USAGE =
  "vlo deploy --profile <name> [--config <path>] [--out deploy/vlo] [--apply]";

export const DEFAULT_OUT = "deploy/vlo";

export interface DeployOptions {
  cwd: string;
  profile: string;
  configPath?: string;
  out?: string;
  apply?: boolean;
}

/** Renders and writes; returns what was written, so tests can snapshot it. */
export async function deploy(options: DeployOptions): Promise<RenderedFile[]> {
  const loaded = await loadConfig(options.cwd, options.profile, options.configPath);
  const plan = planDeploy(loaded);
  const files = render(plan);

  const out = resolve(options.cwd, options.out ?? DEFAULT_OUT);
  for (const file of files) {
    const target = resolve(out, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.contents, "utf8");
    process.stdout.write(`  ✓ ${relative(options.cwd, target)}\n`);
  }

  if (options.apply === true) {
    process.stdout.write(`\n  ${plan.target} — run these yourself:\n\n`);
    for (const command of commands(plan)) {
      process.stdout.write(command.length === 0 ? "\n" : `    ${command}\n`);
    }
    process.stdout.write("\n");
  }
  return files;
}

export async function deployCommand(argv: readonly string[], cwd = process.cwd()): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      config: { type: "string" },
      profile: { type: "string" },
      out: { type: "string" },
      apply: { type: "boolean", default: false },
    },
  });

  const profile = requireProfile(values, USAGE);
  await deploy({
    cwd,
    profile,
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    ...(values.out !== undefined ? { out: values.out } : {}),
    apply: values.apply === true,
  });
}
