#!/usr/bin/env node
/**
 * The `vlo` command: one verb per file under `cli/`.
 *
 * `dev` and `serve` are the same host with different defaults — that is deliberate, and it
 * is why `doctor` and `deploy` read the same profile: whatever runs on a laptop, what a
 * check reports and what a template deploys all come from one place in `vlo.config.ts`.
 */

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dev, USAGE as DEV_USAGE } from "./cli/dev.ts";
import { deployCommand, USAGE as DEPLOY_USAGE } from "./cli/deploy.ts";
import { doctorCommand, USAGE as DOCTOR_USAGE } from "./cli/doctor.ts";
import { version, wantsHelp } from "./cli/help.ts";
import { serveCommand, USAGE as SERVE_USAGE } from "./cli/serve.ts";

const VERB_USAGE: Record<string, string> = {
  dev: DEV_USAGE,
  serve: SERVE_USAGE,
  doctor: DOCTOR_USAGE,
  deploy: DEPLOY_USAGE,
};

const USAGE = [
  ...Object.values(VERB_USAGE),
  "vlo --help | -h | help",
  "vlo --version | -v",
].join("\n");

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  cwd = process.cwd(),
): Promise<void> {
  const [verb, ...rest] = argv;

  if (verb === undefined || verb === "help" || wantsHelp([verb])) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (verb === "--version" || verb === "-v") {
    process.stdout.write(`${version()}\n`);
    return;
  }
  // Before the verb's `parseArgs({ strict: true })` gets a chance to reject the flag.
  const usage = VERB_USAGE[verb];
  if (usage !== undefined && wantsHelp(rest)) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  switch (verb) {
    case "dev":
      await dev(rest, cwd);
      return;
    case "serve":
      await serveCommand(rest, cwd);
      return;
    case "doctor":
      await doctorCommand(rest, cwd);
      return;
    case "deploy":
      await deployCommand(rest, cwd);
      return;
    default:
      process.stderr.write(`unknown command "${verb}"\n${USAGE}\n`);
      process.exitCode = 1;
  }
}

/**
 * True when this module is the process entry point. An installed `vlo` is launched through a
 * symlink in `node_modules/.bin`, so the launch path is resolved before it is compared.
 */
function isEntryPoint(): boolean {
  const launched = process.argv[1];
  if (launched === undefined) return false;
  try {
    return realpathSync(launched) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
