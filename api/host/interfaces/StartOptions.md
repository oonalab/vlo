---
url: /vlo/api/host/interfaces/StartOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StartOptions

# Interface: StartOptions

Defined in: [sdk/ts/sdk/src/client/index.ts:25](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L25)

Options for `Client.start`.

## Properties

### runId?

> `optional` **runId?**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L27)

Caller-chosen run id. Default: host-generated.

***

### search?

> `optional` **search?**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L29)

Search attributes stored on the run.
