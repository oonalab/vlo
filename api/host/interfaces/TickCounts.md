---
url: /vlo/api/host/interfaces/TickCounts.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TickCounts

# Interface: TickCounts

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L83)

What one tick moved, per stage. The tick route answers with exactly this.

## Properties

### notified

> **notified**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L95)

Closed child runs whose parent received its `child` event.

***

### pushed

> **pushed**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L87)

Tasks a transport accepted and the journal recorded as running.

***

### reaped

> **reaped**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:91](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L91)

Attempts failed for a lapsed lease.

***

### started

> **started**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L85)

`created` runs that received their `started` event.

***

### timeouts

> **timeouts**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L93)

Attempts the backstop failed for outliving `timeout_ms`.

***

### timers

> **timers**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L89)

Timers that fired.
