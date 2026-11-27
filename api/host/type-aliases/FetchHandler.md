---
url: /vlo/api/host/type-aliases/FetchHandler.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / FetchHandler

# Type Alias: FetchHandler

> **FetchHandler** = (`request`) => `Promise`<`Response`>

Defined in: [sdk/ts/sdk/src/host/api/router.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/api/router.ts#L24)

A fetch-style request handler: what `Host.fetch`, `handler()` and `listen()` all speak.

## Parameters

### request

`Request`

## Returns

`Promise`<`Response`>
