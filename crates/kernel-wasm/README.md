# vlo-kernel-wasm

`wasm-bindgen` surface over `vlo-kernel`: eight stateless functions, each a JSON string
in and a JSON string out (`kernel_version`, `validate_event`, `prepare_event`,
`reduce_step`, `compute_state_hash`, `plan_retry`, `refold_check`, `derive_ids`).

Build with `../../scripts/build-kernel.sh`, which pins `wasm-pack` 0.12.1, skips
`wasm-opt` so the bytes depend only on the Rust toolchain, enforces the 1 MiB budget and
writes the bindings to `../../sdk/ts/sdk/wasm/` (committed). Set `VLO_WASM_OUT` to build
elsewhere; the SDK loads an alternative binary from `VLO_KERNEL_WASM`.

Depends on `vlo-kernel`. See `docs/kernel-protocol.md`.
