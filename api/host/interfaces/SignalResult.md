---
url: /vlo/api/host/interfaces/SignalResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalResult

# Interface: SignalResult

Defined in: [sdk/ts/sdk/src/client/index.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L51)

What `Client.signal` returns.

## Properties

### delivered

> **delivered**: `boolean`

Defined in: [sdk/ts/sdk/src/client/index.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L55)

False when nothing was waiting: the signal is buffered until a wait opens.

***

### signal_id

> **signal_id**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L53)

The stored signal's id.
