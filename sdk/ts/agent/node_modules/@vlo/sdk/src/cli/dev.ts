/**
 * `vlo dev` — the whole engine on a laptop: SQLite, a file blob store, every role in one
 * process. No hot reload and no console yet; the point is that `vlo dev` and a Cloud Run
 * deployment run the same `serve()`.
 *
 * The profile is `--profile`, then `VLO_PROFILE`, then `local` if the config has one, then
 * the config's only profile. A config with several profiles and no `local` needs the flag.
 */

import { parseArgs } from "node:util";
import { start, type Started } from "./bootstrap.ts";
import { profileArg } from "./help.ts";

export const USAGE = "vlo dev [--config <path>] [--profile <name>] [--port <n>]";

export async function dev(argv: readonly string[], cwd = process.cwd()): Promise<Started> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      config: { type: "string" },
      profile: { type: "string" },
      port: { type: "string" },
    },
  });

  const profile = profileArg(values);
  return start({
    cwd,
    ...(profile !== undefined ? { profile } : {}),
    implicitProfile: true,
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    ...(values.port !== undefined ? { port: Number(values.port) } : {}),
  });
}
