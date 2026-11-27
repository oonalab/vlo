#!/usr/bin/env bash
# Packs @oona/vlo and exercises the tarball the way a user would: install it into an empty
# project, import every entry point and run the `vlo` binary. Needs `pnpm build` first.
#
# This catches what the test suite cannot see, because the suite runs against `src/`: a
# missing file in `files`, a broken `exports` entry, a `bin` that does not start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/sdk/ts/sdk"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ ! -f "$PKG/dist/index.js" ]; then
  echo "error: $PKG/dist is missing; run \`pnpm build\` first" >&2
  exit 1
fi

mkdir "$WORK/pack" "$WORK/consumer"
(cd "$PKG" && pnpm pack --pack-destination "$WORK/pack" >/dev/null)
TARBALL="$(ls "$WORK"/pack/*.tgz)"
echo "packed $(basename "$TARBALL") ($(wc -c < "$TARBALL" | tr -d ' ') bytes)"

cd "$WORK/consumer"
printf '{"name":"consumer","private":true,"type":"module"}\n' > package.json
# vitest is what `@oona/vlo/testing` registers its suites with.
npm install --silent --no-audit --no-fund "$TARBALL" zod vitest

cat > smoke.mjs <<'JS'
import { defineWorkflow } from "@oona/vlo";
import { agentLoop } from "@oona/vlo/agent";
import { createHost } from "@oona/vlo/host";
import { journalConformance } from "@oona/vlo/testing";

const entries = { defineWorkflow, agentLoop, createHost, journalConformance };
for (const [name, value] of Object.entries(entries)) {
  if (typeof value !== "function") throw new Error(`${name} is not exported as a function`);
}
console.log(`ok   imports: ${Object.keys(entries).join(", ")}`);
JS
node smoke.mjs

EXPECTED="$(node -p "JSON.parse(require('node:fs').readFileSync('node_modules/@oona/vlo/package.json','utf8')).version")"
ACTUAL="$(npx --no-install vlo --version)"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL \`vlo --version\` printed \"$ACTUAL\", expected \"$EXPECTED\"" >&2
  exit 1
fi
echo "ok   vlo --version: $ACTUAL"
