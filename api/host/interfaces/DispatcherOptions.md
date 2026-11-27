---
url: /vlo/api/host/interfaces/DispatcherOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / DispatcherOptions

# Interface: DispatcherOptions

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L61)

Tuning for the outbox dispatcher. Every default suits a single laptop host.

## Properties

### backoffBaseMs?

> `optional` **backoffBaseMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L71)

First backoff step after a refused push; doubles per dispatch attempt.

***

### batch?

> `optional` **batch?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L67)

Rows one stage claims per pass. Default 50.

***

### claimHoldMs?

> `optional` **claimHoldMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L69)

How long a claim is held before another orchestrator may take the row.

***

### fetch?

> `optional` **fetch?**: [`FetchLike`](../type-aliases/FetchLike.md)

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L77)

`fetch` used for HTTP pushes. Default `globalThis.fetch`; injected by tests.

***

### maxBackoffMs?

> `optional` **maxBackoffMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L73)

Ceiling on the push backoff. Default 60 s.

***

### mode?

> `optional` **mode?**: [`DispatcherMode`](../type-aliases/DispatcherMode.md)

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L63)

`loop` (default) ticks on a timer and on `kick()`; `manual` only ticks when asked.

***

### tickMs?

> `optional` **tickMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L65)

Interval between passes in `loop` mode. Default 500 ms.

***

### unroutableBackoffMs?

> `optional` **unroutableBackoffMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:75](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L75)

Backoff used when no transport serves the task's queue at all.

***

### workerId?

> `optional` **workerId?**: `string`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L79)

Recorded as `worker_id` on tasks this process dispatches. Default `vlo-<8 hex>`.
