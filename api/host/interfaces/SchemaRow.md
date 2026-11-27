---
url: /vlo/api/host/interfaces/SchemaRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SchemaRow

# Interface: SchemaRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:189](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L189)

One row of `schemas`: an activity or signal definition, keyed by `(name, version)`.

## Properties

### json_schema

> **json_schema**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:195](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L195)

JSON Schema text.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:191](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L191)

Activity or signal name.

***

### retry_policy?

> `optional` **retry_policy?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:197](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L197)

Byte-exact JSON: it is part of the activity content hash.

***

### version

> **version**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:193](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L193)

Content hash of the definition.
