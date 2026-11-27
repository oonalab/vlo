---
url: /vlo/api/host/interfaces/StateRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StateRow

# Interface: StateRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L71)

The checkpoint: rewritten on every transition, in the transition's own transaction.

## Properties

### bundle_digest

> **bundle_digest**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L77)

Digest of the bundle that produced it.

***

### kernel_state

> **kernel_state**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L79)

Kernel-owned state, byte-exact JSON text.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L73)

The run this checkpoint belongs to; one row per run.

***

### seq

> **seq**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:75](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L75)

Seq of the last event folded into it.

***

### state?

> `optional` **state?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L81)

User state, byte-exact JSON text. Exactly one of `state` / `state_ref`.

***

### state_hash

> **state_hash**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L85)

Kernel hash of `(kernel_state, state)`; checked before every fold.

***

### state_ref?

> `optional` **state_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L83)

Blob reference for an offloaded user state.
