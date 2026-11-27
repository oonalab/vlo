#!/usr/bin/env bash
# Builds the docs site and publishes it to the `gh-pages` branch, which GitHub Pages serves.
#
# The site is three things under one URL, all built from the same commit:
#   /          the guides in docs/ (VitePress)
#   /api/      the TypeScript API reference (TypeDoc writes Markdown, VitePress renders it)
#   /rustdoc/  the Rust API reference (cargo doc, copied in as rustdoc's own HTML)
#
# `.github/workflows/docs.yml` runs this on every push to main. A maintainer can run it by
# hand (`pnpm docs:publish`) when Actions is unavailable: same script, same push.
#
#   ./scripts/publish-docs.sh             build and publish
#   ./scripts/publish-docs.sh --dry-run   build and assemble, but do not push
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/docs/.vitepress/dist"
BRANCH="gh-pages"
REMOTE="${DOCS_REMOTE:-origin}"

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "error: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

cd "$ROOT"

# By hand, publish only what is on main: the site must describe a commit others can see.
# CI checks out exactly the pushed commit, so the guards do not apply there.
if [ "${CI:-}" != "true" ] && [ "$DRY_RUN" = false ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "error: the working tree has uncommitted changes; commit or stash them first" >&2
    exit 1
  fi
  git fetch --quiet "$REMOTE" main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse FETCH_HEAD)" ]; then
    echo "error: HEAD is not $REMOTE/main; check out an up-to-date main before publishing" >&2
    exit 1
  fi
fi

SHA="$(git rev-parse --short HEAD)"

echo "==> TypeScript API reference"
# Generated into docs/api/ first: the site build below picks the pages up from there.
rm -rf "$ROOT/docs/api"
pnpm docs:api

echo "==> Rust API reference"
# Removed first so pages for deleted items or old dependency docs never ship.
rm -rf "$ROOT/target/doc"
cargo doc --workspace --no-deps --locked

echo "==> Guides and TypeScript API"
pnpm docs:build

echo "==> Assemble"
cp -R "$ROOT/target/doc" "$DIST/rustdoc"
# A workspace has no top-level rustdoc page; land on the kernel crate.
cat > "$DIST/rustdoc/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=vlo_kernel/">
<title>Vlo Rust API</title>
<a href="vlo_kernel/">Vlo Rust API reference</a>
HTML
# Without this, Pages runs Jekyll and drops every path that starts with an underscore.
touch "$DIST/.nojekyll"

# The commit is built from a throwaway index, so the working tree and the real index are
# never touched. It has no parent: `gh-pages` is always a single commit and never grows.
export GIT_INDEX_FILE="$(mktemp)"
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
rm -f "$GIT_INDEX_FILE"
# `-f`: the repository's .gitignore (dist/, target/) must not filter the built site.
git --work-tree="$DIST" add -A -f
TREE="$(git write-tree)"
FILES="$(git ls-files | wc -l | tr -d ' ')"
COMMIT="$(git commit-tree "$TREE" -m "docs: publish $SHA")"

if [ "$DRY_RUN" = true ]; then
  echo "dry run: $FILES files in commit $COMMIT (from $SHA); nothing pushed"
  exit 0
fi

echo "==> Publish"
git push --force "$REMOTE" "$COMMIT:refs/heads/$BRANCH"
echo "published $FILES files from $SHA to $REMOTE/$BRANCH"
