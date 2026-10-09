# vlo-kernel

The pure kernel: envelope validation, the step state machine, reducer transitions,
canonical hashing, ID derivation, retry planning, and the refold check. No I/O, no
clock, no randomness; `#![forbid(unsafe_code)]`. Every input is JSON in, and errors are
values from the closed code set in `error.rs`.

```sh
cargo test -p vlo-kernel                     # unit, property and golden-fixture tests
UPDATE_FIXTURES=1 cargo test -p vlo-kernel   # only when kernel behaviour changes on purpose
```

Golden fixtures live in `../../fixtures/kernel/`. The TypeScript SDK replays the same
fixtures through the committed wasm, so a fixture change is a protocol change.

Depends on `vlo-types`. See `docs/kernel-protocol.md` and `docs/workflows.md`.
