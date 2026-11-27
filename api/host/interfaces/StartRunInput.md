---
url: /vlo/api/host/interfaces/StartRunInput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StartRunInput

# Interface: StartRunInput

Defined in: [sdk/ts/sdk/src/host/runs.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L52)

What [startRun](../functions/startRun.md) needs.

## Properties

### input

> **input**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/host/runs.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L56)

Start input, journaled on the `started` event. `undefined` is stored as `null`.

***

### namespace?

> `optional` **namespace?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L62)

Namespace to create the run in. Default: the host's.

***

### runId?

> `optional` **runId?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L58)

Caller-chosen id. Default `run_<32 hex>`. Creating an existing id is a no-op.

***

### search?

> `optional` **search?**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/host/runs.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L60)

Search attributes returned on the view and stored on the row.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L54)

Name of a workflow registered on this host.
