---
url: /vlo/api/host/interfaces/ListQuery.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ListQuery

# Interface: ListQuery

Defined in: [sdk/ts/sdk/src/client/index.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L59)

Filters for `Client.list`.

## Properties

### limit?

> `optional` **limit?**: `number`

Defined in: [sdk/ts/sdk/src/client/index.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L65)

Maximum runs. Host default 50.

***

### status?

> `optional` **status?**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/client/index.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L61)

Status to match.

***

### workflow?

> `optional` **workflow?**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L63)

Workflow name to match.
