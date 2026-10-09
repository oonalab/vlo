# vlo-types

Wire types shared by the kernel, its wasm exports and every journal adapter: the event
envelope, reducer events and commands, the `Transition` write-set, retry policies, and
the input/output structs of each kernel function.

Doc comments on these types are the protocol's documentation: `schemars` turns them into
`description` fields in `schema/kernel-protocol.schema.json`, which the TypeScript SDK
validates against.

- Regenerate the schema after any change: `UPDATE_SCHEMA=1 cargo test -p vlo-types`.
- `cargo test -p vlo-types` fails when the committed schema is stale.
- Rules the types enforce: no floats in anything hashed, every time is `*_ms`, hashed
  JSON is carried as a byte-exact `String`.

Depends on nothing in the workspace. See `docs/kernel-protocol.md`.
