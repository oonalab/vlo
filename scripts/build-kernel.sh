#!/usr/bin/env bash
# Build the Vlo kernel to wasm and place it inside @oona/vlo.
# Output is committed so contributors and Vercel builds never need a Rust toolchain;
# CI rebuilds and fails on drift.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# VLO_WASM_OUT lets CI build next to, rather than over, the committed artifact.
OUT="${VLO_WASM_OUT:-$ROOT/sdk/ts/sdk/wasm}"
MAX_BYTES=$((1024 * 1024)) # see docs/limits.md: kernel wasm ≤ 1 MiB

# Panic-location strings survive `strip` and embed absolute source paths, which differ per
# machine (/Users/… vs /home/runner/…) and would break the CI drift gate. Remap the cargo
# registry and this workspace to fixed prefixes so the artifact is byte-identical everywhere.
CARGO_DIR="${CARGO_HOME:-$HOME/.cargo}"
export RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=${CARGO_DIR}/registry/src=/cargo/registry/src --remap-path-prefix=${ROOT}=/vlo"

wasm-pack build "$ROOT/crates/kernel-wasm" \
  --release \
  --target web \
  --no-pack \
  --out-name vlo_kernel \
  --out-dir "$OUT"

# wasm-pack writes a `.gitignore` containing `*` into out-dir, which would silently
# unstage the committed artifact.
rm -f "$OUT/.gitignore" "$OUT/README.md" "$OUT/package.json"

SIZE=$(wc -c < "$OUT/vlo_kernel_bg.wasm" | tr -d ' ')
echo "vlo_kernel_bg.wasm: ${SIZE} bytes"
if [ "$SIZE" -gt "$MAX_BYTES" ]; then
  echo "error: kernel wasm exceeds ${MAX_BYTES} bytes" >&2
  exit 1
fi
