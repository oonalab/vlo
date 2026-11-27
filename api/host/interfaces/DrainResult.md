---
url: /vlo/api/host/interfaces/DrainResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / DrainResult

# Interface: DrainResult

Defined in: [sdk/ts/sdk/src/host/drain.ts:31](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/drain.ts#L31)

## Properties

### counts

> **counts**: [`TickCounts`](TickCounts.md)

Defined in: [sdk/ts/sdk/src/host/drain.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/drain.ts#L37)

The counts of the last pass.

***

### idle

> **idle**: `boolean`

Defined in: [sdk/ts/sdk/src/host/drain.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/drain.ts#L35)

True when the drain stopped because there was nothing left, false when it ran out of time.

***

### passes

> **passes**: `number`

Defined in: [sdk/ts/sdk/src/host/drain.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/drain.ts#L33)

How many dispatcher passes ran.
