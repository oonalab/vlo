---
url: /vlo/api/host/interfaces/StartFreshResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StartFreshResult

# Interface: StartFreshResult

Defined in: [sdk/ts/sdk/src/client/index.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L43)

What `Client.startFresh` returns.

## Properties

### joined

> **joined**: `boolean`

Defined in: [sdk/ts/sdk/src/client/index.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L47)

True when a live run under the key was joined instead of a new one started.

***

### run

> **run**: [`RunView`](RunView.md)

Defined in: [sdk/ts/sdk/src/client/index.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L45)

The run started or joined.
