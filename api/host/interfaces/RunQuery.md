---
url: /vlo/api/host/interfaces/RunQuery.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RunQuery

# Interface: RunQuery

Defined in: [sdk/ts/sdk/src/journal/types.ts:263](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L263)

Filters for `Journal.query`. All optional; every given field must match.

## Properties

### limit?

> `optional` **limit?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:271](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L271)

Maximum rows, newest first.

***

### namespace?

> `optional` **namespace?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:265](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L265)

Namespace to list.

***

### status?

> `optional` **status?**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/journal/types.ts:267](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L267)

Status to match.

***

### workflow?

> `optional` **workflow?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:269](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L269)

Workflow name to match.
