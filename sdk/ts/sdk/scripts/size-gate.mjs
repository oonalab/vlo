// Size budgets are a CI gate (see docs/limits.md).
//
// "Runtime" is what a host actually imports: every chunk reachable from `index.js` and
// `host.js`. The CLI (`cli.js` and the chunks only it reaches) is budgeted separately, and
// `testing.js` is not budgeted at all. CLI code showing up in a runtime chunk fails.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (rel) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const dist = root("dist");
const IMPORT = /from\s+"\.\/([^"]+\.js)"/g;

function reachable(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(`${dist}/${file}`, "utf8").matchAll(IMPORT)) {
      queue.push(match[1]);
    }
  }
  return seen;
}

const bytes = (files) => [...files].reduce((sum, f) => sum + statSync(`${dist}/${f}`).size, 0);

const runtime = reachable(["index.js", "host.js"]);
const cliOnly = new Set([...reachable(["cli.js"])].filter((f) => !runtime.has(f)));
const all = readdirSync(dist).filter((f) => f.endsWith(".js"));

const budgets = [
  ["wasm/vlo_kernel_bg.wasm", 1024 * 1024, () => statSync(root("wasm/vlo_kernel_bg.wasm")).size],
  ["runtime JS (reachable from index.js + host.js)", 256 * 1024, () => bytes(runtime)],
  ["cli JS (reachable only from cli.js)", 96 * 1024, () => bytes(cliOnly)],
];

let failed = false;
for (const [label, max, measure] of budgets) {
  let size;
  try {
    size = measure();
  } catch {
    console.error(`missing ${label}`);
    failed = true;
    continue;
  }
  const ok = size <= max;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} ${size} B (budget ${max} B)`);
  if (!ok) failed = true;
}
// A bundler folds a leaked CLI import into the shared runtime chunk rather than keeping
// `cli.js` reachable, so the guard looks for code only the CLI contains.
const CLI_ONLY = ["parseArgs(", "cloudbuild", "--no-migrate"];
for (const file of runtime) {
  const text = readFileSync(`${dist}/${file}`, "utf8");
  const leaked = CLI_ONLY.find((needle) => text.includes(needle));
  if (leaked !== undefined) {
    console.error(`FAIL runtime chunk ${file} contains CLI code (${JSON.stringify(leaked)})`);
    failed = true;
  }
}
console.log(`info dist/*.js total ${bytes(all)} B across ${all.length} chunks`);
process.exit(failed ? 1 : 0);
