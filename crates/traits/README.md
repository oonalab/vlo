# vlo-traits

`Journal`, `BlobStore` and `TaskTransport` as Rust traits, mirroring the TypeScript
interfaces in `@oona/vlo/host` so a Rust host can reuse the kernel's write-set contract
unchanged. The TypeScript host is the only host today; this crate is kept in sync and has
no implementation.

Depends on `vlo-types`. See `docs/journal.md` and `docs/architecture.md`.
