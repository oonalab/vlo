/**
 * `vlo doctor` — is this profile actually wired up?
 *
 * Every line is a real round trip (see `checks.ts`), rendered as one table with a fix hint
 * on anything that is not ✓. Any ✗ sets a non-zero exit code, so a deploy pipeline can gate
 * on it; `--json` prints the same array for a machine.
 */

import { parseArgs } from "node:util";
import { loadConfig } from "../config/load.ts";
import { runChecks, type Check, type CheckStatus } from "./checks.ts";
import { requireProfile } from "./help.ts";

export const USAGE = "vlo doctor --profile <name> [--config <path>] [--json] [--no-migrate]";

export interface DoctorOptions {
  cwd: string;
  profile: string;
  configPath?: string;
  migrate?: boolean;
  fetch?: typeof fetch;
}

const ICONS: Record<CheckStatus, string> = { ok: "✓", warn: "⚠", fail: "✗" };

/** The whole verb minus argument parsing and printing, so tests can assert on the checks. */
export async function doctor(options: DoctorOptions): Promise<Check[]> {
  const loaded = await loadConfig(options.cwd, options.profile, options.configPath);
  return runChecks(loaded, {
    migrate: options.migrate ?? true,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });
}

export async function doctorCommand(argv: readonly string[], cwd = process.cwd()): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    // `--no-migrate` is the documented flag; `migrate` defaults on.
    allowNegative: true,
    options: {
      config: { type: "string" },
      profile: { type: "string" },
      json: { type: "boolean", default: false },
      migrate: { type: "boolean", default: true },
    },
  });

  const profile = requireProfile(values, USAGE);
  const checks = await doctor({
    cwd,
    profile,
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    migrate: values.migrate !== false,
  });

  process.stdout.write(values.json === true ? `${JSON.stringify(checks, null, 2)}\n` : table(checks));
  if (checks.some((c) => c.status === "fail")) process.exitCode = 1;
}

export function table(checks: Check[]): string {
  const width = Math.max(0, ...checks.map((c) => c.check.length));
  let out = "";
  for (const check of checks) {
    out += `  ${ICONS[check.status]} ${check.check.padEnd(width)}  ${check.detail}\n`;
    if (check.hint !== undefined) out += `  ${" ".repeat(width + 3)} → ${check.hint}\n`;
  }
  return out;
}
