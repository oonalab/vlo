**What changes and why**

**Layer**: kernel / host / SDK / agent / CLI / docs

**Checklist**
- [ ] Tests: fixture for kernel behaviour, vitest for host behaviour
- [ ] `./scripts/build-kernel.sh` run and `sdk/ts/sdk/wasm/` committed (kernel changes)
- [ ] `UPDATE_SCHEMA=1 cargo test -p vlo-types` run (type changes)
- [ ] Docs updated (`docs/`, TSDoc, rustdoc)
- [ ] `CHANGELOG.md` entry under Unreleased
