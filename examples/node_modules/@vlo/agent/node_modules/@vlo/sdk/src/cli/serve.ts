/**
 * `vlo serve` — the production twin of `vlo dev`.
 *
 * Same code path, no conveniences: the profile is required (there is no SQLite fallback to
 * silently land on), nothing is created on disk, and `PORT` is honoured because that is how
 * Cloud Run and every other container platform tells a process where to listen.
 */

import { parseArgs } from "node:util";
import { start, type Started } from "./bootstrap.ts";
import { requireProfile } from "./help.ts";

export const USAGE = "vlo serve --profile <name> [--config <path>] [--port <n>]";

export async function serveCommand(
  argv: readonly string[],
  cwd = process.cwd(),
): Promise<Started> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      config: { type: "string" },
      profile: { type: "string" },
      port: { type: "string" },
    },
  });

  const profile = requireProfile(values, USAGE);
  const port = values.port ?? process.env["PORT"];
  return start({
    cwd,
    profile,
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    ...(port !== undefined && port.length > 0 ? { port: Number(port) } : {}),
  });
}
