// Markdown link gate: every relative link in this repository resolves to a file that
// exists inside the package, and no page leans on the monorepo it was extracted from.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "target", "dist", "api", ".vlo", ".git", ".claude"]);
const FORBIDDEN = [/docs\/64/, /\bOrbi\b/];
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REF_DEF = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

function* markdownFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* markdownFiles(path);
    else if (entry.endsWith(".md")) yield path;
  }
}

function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");
}

const problems = [];
let files = 0;
let links = 0;

for (const file of markdownFiles(ROOT)) {
  files++;
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const targets = [...text.matchAll(LINK), ...text.matchAll(REF_DEF)].map((m) => m[1]);

  for (const raw of targets) {
    if (isExternal(raw) || raw.startsWith("#")) continue;
    links++;
    const [pathPart] = raw.split("#");
    const target = resolve(dirname(file), decodeURI(pathPart));
    if (!target.startsWith(ROOT + sep) && target !== ROOT) {
      problems.push(`${rel}: link leaves the package: ${raw}`);
    } else if (!existsSync(target)) {
      problems.push(`${rel}: broken link: ${raw}`);
    }
  }

  if (rel === "CHANGELOG.md") continue;
  for (const pattern of FORBIDDEN) {
    const hit = text.match(pattern);
    if (hit) problems.push(`${rel}: forbidden reference "${hit[0]}"`);
  }
}

for (const p of problems) console.error(`FAIL ${p}`);
console.log(`${problems.length ? "FAIL" : "ok  "} ${files} markdown files, ${links} relative links`);
process.exit(problems.length ? 1 : 0);
