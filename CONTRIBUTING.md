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
| pnpm | 10 or newer | workspace: `sdk/ts/sdk`, `sdk/ts/agent`, `examples` |
| Postgres | optional, 16+ | `VLO_TEST_DATABASE_URL` runs the Postgres conformance suite |

## The loop

```sh
cargo test --workspace                       # kernel: unit, proptest, golden fixtures
./scripts/build-kernel.sh                    # after any kernel change; commit sdk/ts/sdk/wasm/
pnpm --filter @vlo/sdk test                  # SDK on SQLite
pnpm --filter @vlo/agent test
pnpm --filter @vlo/examples typecheck
pnpm --filter @vlo/sdk exec tsx src/cli.ts dev --config ../../../examples/hello/vlo.config.ts --profile dev
```

Two generated artifacts are committed and CI checks them:

- `schema/kernel-protocol.schema.json` — regenerate with `UPDATE_SCHEMA=1 cargo test -p vlo-types`.
  Doc comments on `vlo-types` land in this file, so documenting a type regenerates it.
- `fixtures/kernel/*.json` — golden transitions. Regenerate with
  `UPDATE_FIXTURES=1 cargo test -p vlo-kernel` **only** when you intend to change kernel
  behaviour, and say so in the PR.

## What CI gates

The workflow runs four jobs. A change must pass all of them.

1. **Kernel + SDK** — `cargo fmt`, `cargo clippy -D warnings`, `cargo test`, wasm build,
   protocol schema unchanged, SDK typecheck + tests, the CI-built wasm replays every golden
   fixture through the TypeScript kernel loader (`VLO_KERNEL_WASM`), SDK build, size budgets
   (`sdk/ts/sdk/scripts/size-gate.mjs`: wasm ≤ 1 MiB, runtime JS reachable from `index.js` + `host.js` ≤ 256 KB, CLI-only JS ≤ 96 KB, and `cli.js` must never be reachable from the runtime).
2. **Docs** — `cargo doc` with warnings as errors, TypeDoc with `notDocumented` as an
   error, `scripts/check-links.mjs` (every relative Markdown link resolves inside the
   package; no page references the monorepo Vlo was extracted from).
3. **Standalone build** — the package installs and typechecks with nothing outside it.

Byte-level wasm drift between macOS and Linux builds is reported, not fatal; the fixture
replay is the equivalence check.

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
  for both dialects and extend `journalConformance` in `@vlo/sdk/testing`.
- **Config changes touch three places**: `defineConfig` types, `vlo doctor` checks, and
  `docs/configuration.md`.

## Pull requests

- One concern per PR. Describe the behaviour change, not the diff.
- Include tests: a fixture for kernel behaviour, a vitest for host behaviour.
- Update `CHANGELOG.md` under **Unreleased**.
- Commit messages: imperative subject ≤ 72 characters, a body that says why.

## Reporting

Bugs and ideas: open an issue with the template. Security problems: see `SECURITY.md`,
not an issue.
