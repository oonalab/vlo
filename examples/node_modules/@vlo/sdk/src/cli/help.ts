/** `--help` detection, the `--profile` fallback and the package version, shared by every verb. */

import { readFileSync } from "node:fs";

/** From `src/cli/` (tsx) and from `dist/` (built), respectively. */
const PACKAGE_JSON_CANDIDATES = ["../../package.json", "../package.json"];

export function wantsHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

/** `--profile`, then `VLO_PROFILE`; an empty value counts as unset. */
export function profileArg(values: { profile?: string | undefined }): string | undefined {
  const profile = values.profile ?? process.env["VLO_PROFILE"];
  return profile === undefined || profile.length === 0 ? undefined : profile;
}

/** {@link profileArg}, but a missing profile is an error quoting the verb's usage. */
export function requireProfile(values: { profile?: string | undefined }, usage: string): string {
  const profile = profileArg(values);
  if (profile === undefined) {
    throw new Error(`${usage}\n  --profile is required (or set VLO_PROFILE)`);
  }
  return profile;
}

export function version(): string {
  for (const candidate of PACKAGE_JSON_CANDIDATES) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(candidate, import.meta.url), "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === "@vlo/sdk" && typeof pkg.version === "string") return pkg.version;
    } catch {
      continue;
    }
  }
  throw new Error("vlo: could not find the SDK's package.json");
}
