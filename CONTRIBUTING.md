# Contributing to Vlo

Thanks for helping. This page is the whole onboarding: toolchain, the loop, the gates CI
runs, and what a good change looks like.

## Toolchain

| Tool | Version | Why |
|---|---|---|
| Rust | pinned in `rust-toolchain.toml` (`rustup show` installs it) | kernel, types, traits |
| `wasm32-unknown-unknown` target | installed by the toolchain file | kernel wasm |
| `wasm-pack` | 0.12.1 | builds the committed wasm bindings |
| Node.js | ≥ 22.5 | `node:sqlite` in the SQLite journal |
| pnpm | 10 or newer | workspace: `sdk/ts/sdk`, `examples` (`pnpm-workspace.yaml`) |
| Postgres | optional, 16+ | `VLO_TEST_DATABASE_URL` runs the Postgres conformance suite |

## The loop

```sh
pnpm install                                 # once, from the repo root
cargo test --workspace                       # kernel: unit, proptest, golden fixtures
./scripts/build-kernel.sh                    # after any kernel change; commit sdk/ts/sdk/wasm/
pnpm --filter @oona/vlo test                 # SDK and agent layer on SQLite
pnpm --filter @oona/vlo-examples typecheck
pnpm --filter @oona/vlo exec tsx src/cli.ts dev --config ../../../examples/hello/vlo.config.ts --profile dev
```

Two generated artifacts are committed and CI checks them:

- `schema/kernel-protocol.schema.json` — regenerate with `UPDATE_SCHEMA=1 cargo test -p vlo-types`.
  Doc comments on `vlo-types` land in this file, so documenting a type regenerates it.
- `fixtures/kernel/*.json` — golden transitions. Regenerate with
  `UPDATE_FIXTURES=1 cargo test -p vlo-kernel` **only** when you intend to change kernel
  behaviour, and say so in the PR.

## What CI gates

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`. It has three
jobs, and a change must pass all of them.

1. **Kernel + SDK** — `cargo fmt`, `cargo clippy -D warnings`, `cargo test`, wasm build,
   protocol schema unchanged, typecheck, the full SDK suite on SQLite and on a Postgres 16
   service, the CI-built wasm replays every golden fixture through the TypeScript kernel
   loader (`VLO_KERNEL_WASM`), SDK build, size budgets
   (`sdk/ts/sdk/scripts/size-gate.mjs`: wasm ≤ 1 MiB, runtime JS reachable from `index.js` + `host.js` ≤ 256 KB, CLI-only JS ≤ 96 KB, and `cli.js` must never be reachable from the runtime).
2. **Docs** — `cargo doc` with warnings as errors, TypeDoc with `notDocumented` as an
   error, `scripts/check-links.mjs` (every relative Markdown link resolves inside the
   repository; no page references the monorepo Vlo was extracted from).
3. **Published package** — `scripts/smoke-package.sh` packs `@oona/vlo`, installs the
   tarball into an empty project, imports every entry point and runs `vlo --version`, on
   Node 22 and Node 24. The test suite runs against `src/`, so this is the only gate that
   sees a broken `exports` entry, a file missing from `files` or a `bin` that does not start.

Byte-level wasm drift between macOS and Linux builds is reported, not fatal; the fixture
replay is the equivalence check.

Run the same gates locally before pushing:

```sh
cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm -r typecheck && pnpm test
pnpm build && pnpm --filter @oona/vlo size && ./scripts/smoke-package.sh
pnpm docs:api && pnpm check:links
```

## Making a change

- **Kernel first, host second.** Behaviour that decides what a run does belongs in the
  reducer or the kernel and gets a fixture. The host only persists and moves bytes.
- **No I/O in the kernel.** No clock, no randomness, no allocation-dependent ordering in
  anything hashed. `cargo test` has proptests that will catch most of this.
- **Every public item is documented.** Rust: `missing_docs` is denied on `vlo-types` and
  `vlo-traits`. TypeScript: TypeDoc fails on an undocumented export or property.
- **Files stay under 400 lines** and do one thing. Split before you exceed it.
- **Errors are values.** Add a code to the closed set in `crates/kernel/src/error.rs` or a
  `VloError` subclass in `sdk/ts/sdk/src/host/errors.ts`; document it in `docs/errors.md`.
- **Journal changes are migrations.** Add `000N_name` to `sdk/ts/sdk/src/journal/migrations.ts`
  for both dialects and extend `journalConformance` in `@oona/vlo/testing`.
- **Config changes touch three places**: `defineConfig` types, `vlo doctor` checks, and
  `docs/configuration.md`.

## Pull requests

- One concern per PR. Describe the behaviour change, not the diff.
- Include tests: a fixture for kernel behaviour, a vitest for host behaviour.
- **The PR title is a [Conventional Commit](https://www.conventionalcommits.org/)**:
  `type(optional-scope): summary`. PRs are squash-merged, so the title becomes the commit on
  `main`, and that commit decides the next version and becomes the changelog line. The
  `PR title` check enforces the format (`scripts/check-pr-title.sh`).
- Do not edit `CHANGELOG.md` or any version number; the release automation owns both.

| Title starts with | Changelog section | Version bump below 1.0 | From 1.0 on |
|---|---|---|---|
| `fix:` | Bug Fixes | patch | patch |
| `feat:` | Features | patch | minor |
| `feat!:`, `fix!:` or a `BREAKING CHANGE:` footer | Breaking Changes | minor | major |
| `perf:`, `revert:` | listed | patch | patch |
| `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:` | hidden | none | none |

Write the summary for a user reading the changelog: what changed for them, in the
imperative, with no trailing full stop.

## Releasing

Releases are cut by `.github/workflows/release.yml`, using
[release-please](https://github.com/googleapis/release-please) and npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers). Nobody runs `npm publish`
by hand and no npm token is stored.

1. **Merge PRs to `main`.** After each merge the workflow opens or updates one pull request
   titled `chore(main): release <version>`. It carries the next version and the new
   changelog entry, both derived from the commits since the last release.
2. **Review that Release PR.** The version is bumped in `sdk/ts/sdk/package.json`,
   `Cargo.toml`, `Cargo.lock` and `.release-please-manifest.json`; the entry is added to
   `CHANGELOG.md`. Leave it open to batch more changes into one release.
3. **Merge it to ship.** The workflow tags `v<version>`, creates the GitHub release, runs
   every CI gate, runs `scripts/smoke-package.sh` and publishes `@oona/vlo` to npm with a
   provenance attestation.

Two things to know:

- Pull requests opened by the workflow's own token do not start other workflows, so the
  Release PR shows no CI checks. The gates run after the merge and before the publish; a
  failure there stops the publish and leaves the tag in place. Fix forward with a new PR.
- To force a version, add a `Release-As: 1.0.0` footer to a commit on `main`.

`@oona/vlo` is the only published package; `examples` and the workspace root are private.
The crates are not published to crates.io.

### One-time setup

Trusted publishing can only be attached to a package that already exists, so 0.1.0 was
published by hand. For a new package, or to repeat the setup:

```sh
pnpm install && pnpm build && ./scripts/smoke-package.sh
cd sdk/ts/sdk
npm login                                        # a member of the `oona` npm org
npm publish --access public                      # asks for a 2FA code
git tag v0.1.0 && git push origin v0.1.0         # the baseline release-please counts from
gh release create v0.1.0 --title v0.1.0 --notes "First release. See CHANGELOG.md."
```

Then, once:

- **npmjs.com** → the package → Settings → Trusted Publisher → GitHub Actions:
  organization `oonalab`, repository `vlo`, workflow filename `release.yml`.
- **GitHub** → Settings → Actions → General → Workflow permissions: allow GitHub Actions
  to create and approve pull requests.
- **GitHub** → Settings → General → Pull Requests: allow squash merging only, with the
  default commit message set to the pull request title.

## Reporting

Bugs and ideas: open an issue with the template. Security problems: see `SECURITY.md`,
not an issue.
