---
url: /vlo/api/host/interfaces/StartFreshOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StartFreshOptions

# Interface: StartFreshOptions

Defined in: [sdk/ts/sdk/src/client/index.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L33)

Options for `Client.startFresh`.

## Properties

### maxChain?

> `optional` **maxChain?**: `number`

Defined in: [sdk/ts/sdk/src/client/index.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L39)

How many ended runs to walk past before giving up. Default 50.

***

### runId

> **runId**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L35)

The key every run of this unit of work shares; the first run's id.

***

### search?

> `optional` **search?**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L37)

Search attributes stored on the run when one is started.
