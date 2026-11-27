// Doc snippet gate: a code block tagged with its source file must appear in that file.
//
//   <!-- snippet: examples/harness/activities.ts -->
//   ```ts
//   …lines copied from that file…
//   ```
//
// The tagged files are typechecked and, where they are tests, run in CI (`pnpm -r typecheck`,
// `pnpm --filter @oona/vlo-examples test`), so a tagged block is code that compiles. The pages
// stay plain Markdown that renders on GitHub: the tag is an HTML comment, and the code is
// copied, not imported. A block must match a run of consecutive lines; indentation common to
// the whole run and trailing whitespace are ignored.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "target", "dist", "api", ".vlo", ".git", ".claude", ".vitepress"]);
const TAG = /^<!--\s*snippet:\s*(\S+)\s*-->$/;

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* markdownFiles(path);
    else if (entry.endsWith(".md")) yield path;
  }
}

/** Trailing whitespace off, then the indentation every non-blank line shares. */
function normalise(lines) {
  const trimmed = lines.map((line) => line.trimEnd());
  const indents = trimmed.filter((line) => line !== "").map((line) => line.length - line.trimStart().length);
  const common = indents.length ? Math.min(...indents) : 0;
  return trimmed.map((line) => line.slice(common)).join("\n");
}

function contains(sourceLines, blockLines) {
  const wanted = normalise(blockLines);
  for (let start = 0; start + blockLines.length <= sourceLines.length; start++) {
    if (normalise(sourceLines.slice(start, start + blockLines.length)) === wanted) return true;
  }
  return false;
}

const problems = [];
let snippets = 0;

for (const file of markdownFiles(ROOT)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const tag = TAG.exec(lines[i].trim());
    if (!tag) continue;
    const at = `${rel}:${i + 1}`;

    let open = i + 1;
    while (open < lines.length && lines[open].trim() === "") open++;
    if (open >= lines.length || !lines[open].startsWith("```")) {
      problems.push(`${at}: snippet tag is not followed by a code block`);
      continue;
    }
    let close = open + 1;
    while (close < lines.length && !lines[close].startsWith("```")) close++;
    const block = lines.slice(open + 1, close);
    snippets++;

    const source = resolve(ROOT, tag[1]);
    if (!source.startsWith(ROOT + sep) || !existsSync(source)) {
      problems.push(`${at}: no such source file: ${tag[1]}`);
      continue;
    }
    if (block.length === 0 || !contains(readFileSync(source, "utf8").split("\n"), block)) {
      problems.push(`${at}: the block is not in ${tag[1]}; copy it from the source file again`);
    }
  }
}

for (const p of problems) console.error(`FAIL ${p}`);
console.log(`${problems.length ? "FAIL" : "ok  "} ${snippets} tagged snippets`);
process.exit(problems.length ? 1 : 0);
