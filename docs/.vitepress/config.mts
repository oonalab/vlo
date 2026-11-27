// The docs site. `docs/` is the source directory as it stands: plain Markdown that also
// renders on GitHub, no frontmatter. `scripts/publish-docs.sh` builds and publishes it.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import llmstxt from "vitepress-plugin-llms";
import type { Plugin } from "vite";
import { withMermaid } from "vitepress-plugin-mermaid";

const DOCS = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(DOCS, "..");
const REPO = "https://github.com/oonalab/vlo";

// GitHub Pages serves a project site under `/<repo>/`. Set DOCS_BASE=/ for a custom domain.
const base = process.env.DOCS_BASE ?? "/vlo/";

// Pages link to files outside `docs/` (`../examples/hello/`, `../sdk/ts/sdk/test/…`). Those
// are not part of the site, so they become links to the same path on GitHub. The Markdown
// keeps the relative form, which `scripts/check-links.mjs` validates against the checkout.
function linkOutsideDocs(href: string, pageDir: string): string | undefined {
  if (!href.startsWith("../")) return undefined;
  const [path, hash] = href.split("#");
  const target = resolve(pageDir, decodeURI(path));
  if (target.startsWith(DOCS) || !target.startsWith(ROOT) || !existsSync(target)) return undefined;
  const kind = statSync(target).isDirectory() ? "tree" : "blob";
  return `${REPO}/${kind}/main/${relative(ROOT, target)}${hash ? `#${hash}` : ""}`;
}

// The TypeScript API reference is Markdown that TypeDoc writes into `docs/api/` (`pnpm
// docs:api`), so it is part of the site: same theme, same search. It is generated, not
// committed, and its sidebar comes with it. Without it the site still builds, minus /api/.
const API_SIDEBAR = resolve(DOCS, "api/typedoc-sidebar.json");
// TypeDoc names each entry point after its source file. Readers know them by what they
// import, so the sidebar and the page titles use that, main entry first.
const ENTRY_POINTS: Record<string, string> = {
  index: "@oona/vlo",
  host: "@oona/vlo/host",
  agent: "@oona/vlo/agent",
  testing: "@oona/vlo/testing",
};
type SidebarGroup = { text: string; link?: string; collapsed?: boolean; items?: SidebarGroup[] };
const apiSidebar: SidebarGroup[] = (
  existsSync(API_SIDEBAR) ? (JSON.parse(readFileSync(API_SIDEBAR, "utf8")) as SidebarGroup[]) : []
)
  .sort((a, b) => Object.keys(ENTRY_POINTS).indexOf(a.text) - Object.keys(ENTRY_POINTS).indexOf(b.text))
  .map((group) => ({ ...group, text: ENTRY_POINTS[group.text] ?? group.text }));

// The Rust API reference is rustdoc's own HTML, which VitePress cannot build. The publish
// script copies it into the built site; this serves the same directory from `pnpm docs:dev`,
// so the nav link works locally once it has been generated.
const GENERATED = [
  {
    url: "rustdoc/",
    dir: resolve(ROOT, "target/doc"),
    index: "vlo_kernel/index.html",
    build: "cargo doc --workspace --no-deps",
  },
];
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function generatedReferences(): Plugin {
  return {
    name: "vlo-generated-references",
    apply: "serve",
    configureServer(server) {
      // The config reads the API sidebar once, at startup. If the reference is regenerated
      // while the dev server runs (`pnpm docs:api`), say so rather than show a stale sidebar.
      server.watcher.add(API_SIDEBAR);
      const notice = (file: string) => {
        if (file !== API_SIDEBAR) return;
        server.config.logger.warn("The API reference was regenerated. Restart `pnpm docs:dev` to refresh its sidebar.");
      };
      server.watcher.on("add", notice).on("change", notice);
      server.middlewares.use((req, res, next) => {
        const path = decodeURI((req.url ?? "").split(/[?#]/)[0]);
        const ref = GENERATED.find((g) => (path + "/").startsWith(base + g.url));
        if (!ref) return next();
        const prefix = base + ref.url;
        const rest = path.slice(prefix.length);
        if (path.length < prefix.length || rest === "") {
          res.statusCode = 302;
          res.setHeader("Location", prefix + ref.index);
          return res.end();
        }
        let file = resolve(ref.dir, rest);
        if (file !== ref.dir && !file.startsWith(ref.dir + sep)) return next();
        if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, "index.html");
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          const missing = existsSync(ref.dir)
            ? `No such page in the generated reference: <code>${rest.replace(/[<&]/g, "")}</code>`
            : `This reference has not been generated yet. Run <code>${ref.build}</code> from the repository root, then reload.`;
          return res.end(`<!doctype html><meta charset="utf-8"><title>Vlo</title><body style="font:16px system-ui;margin:3rem"><p>${missing}</p><p><a href="${base}">Back to the docs</a></p>`);
        }
        res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

const config = withMermaid({
  title: "Vlo",
  description:
    "An event-sourced durable execution engine for workflows and agents. Workflows are pure reducers; your Postgres or SQLite is the journal.",
  base,
  cleanUrls: true,
  // `docs/README.md` is the index on GitHub and the home page here.
  rewrites: { "README.md": "index.md" },
  // rustdoc is static HTML added after the build, so VitePress cannot see it.
  ignoreDeadLinks: [/^\/rustdoc\//],
  // Generated pages have no source file to edit.
  transformPageData(pageData) {
    if (pageData.relativePath.startsWith("api/")) pageData.frontmatter.editLink = false;
  },

  markdown: {
    config(md) {
      // An entry point's own page: title it by its import path, not its file name.
      md.core.ruler.push("vlo-entry-point-titles", (state) => {
        const entry = /^api\/(\w+)\/index\.md$/.exec(state.env.relativePath ?? "")?.[1];
        const title = entry && ENTRY_POINTS[entry];
        const h1 = state.tokens.findIndex((t) => t.type === "heading_open" && t.tag === "h1");
        if (!title || h1 < 0) return;
        const inline = state.tokens[h1 + 1];
        inline.content = title;
        const text = new state.Token("text", "", 0);
        text.content = title;
        inline.children = [text];
      });
      md.core.ruler.push("vlo-links-outside-docs", (state) => {
        const pageDir = dirname(resolve(DOCS, state.env.relativePath ?? ""));
        for (const block of state.tokens) {
          for (const token of block.children ?? []) {
            if (token.type !== "link_open") continue;
            const rewritten = linkOutsideDocs(token.attrGet("href") ?? "", pageDir);
            if (rewritten) token.attrSet("href", rewritten);
          }
        }
      });
    },
  },

  vite: {
    plugins: [llmstxt(), generatedReferences()],
  },

  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "TypeScript API", link: "/api/", activeMatch: "^/api/" },
      // rustdoc keeps its own look, so it opens as the separate site it is.
      { text: "Rust API", link: "/rustdoc/", target: "_blank" },
    ],
    sidebar: {
      "/api/": [{ text: "TypeScript API", link: "/api/", items: apiSidebar }],
      "/": [
        {
          text: "Learn",
          items: [
            { text: "Getting started", link: "/getting-started" },
            { text: "Concepts", link: "/concepts" },
            { text: "Why Vlo", link: "/why-vlo" },
            { text: "Workflows", link: "/workflows" },
            { text: "Activities and workers", link: "/activities-and-workers" },
            { text: "Signals and humans", link: "/signals-and-humans" },
            { text: "Agents", link: "/agents" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Configuration", link: "/configuration" },
            { text: "CLI", link: "/cli" },
            { text: "HTTP API", link: "/http-api" },
            { text: "Journal", link: "/journal" },
            { text: "Errors", link: "/errors" },
            { text: "Limits", link: "/limits" },
            { text: "Observability", link: "/observability" },
            { text: "Deployment", link: "/deployment" },
          ],
        },
        {
          text: "Internals",
          items: [
            { text: "Architecture", link: "/architecture" },
            { text: "Kernel protocol", link: "/kernel-protocol" },
            { text: "Design decisions", link: "/design-decisions" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: REPO }],
    search: { provider: "local" },
    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`,
      text: "Edit this page on GitHub",
    },
    outline: [2, 3],
  },
});

// The plugin asks Vite to pre-bundle mermaid's CommonJS dependencies (dayjs, cytoscape, …) by
// bare name. Under pnpm those are not resolvable from the workspace root, so the dev server
// served them raw and the page failed to load. Pre-bundling mermaid itself pulls them in.
config.vite!.optimizeDeps!.include = ["mermaid"];

export default config;
