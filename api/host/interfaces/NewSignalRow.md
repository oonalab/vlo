---
url: /vlo/api/host/interfaces/NewSignalRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / NewSignalRow

# Interface: NewSignalRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:227](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L227)

What `putSignal` inserts.

## Properties

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:233](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L233)

Signal name.

***

### payload?

> `optional` **payload?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:235](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L235)

Inline payload, byte-exact JSON.

***

### payload_ref?

> `optional` **payload_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:237](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L237)

Blob reference for an offloaded payload.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:231](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L231)

The run it is sent to.

***

### sender?

> `optional` **sender?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:239](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L239)

Free-form sender.

***

### signal_id

> **signal_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:229](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L229)

Primary key.
