---
url: /vlo/api/host/interfaces/InProcessOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / InProcessOptions

# Interface: InProcessOptions

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L54)

Knobs for [InProcessTransport](../classes/InProcessTransport.md).

## Properties

### onError?

> `optional` **onError?**: (`error`) => `void`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L62)

Where a failure to *report* goes. The handler's own throw is a task failure and the
reporter turns it into one; this is the reporter itself failing — a journal that closed
under a shutdown, typically — and without a home it would be an unhandled rejection.

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### tracker?

> `optional` **tracker?**: [`InProcessTracker`](../classes/InProcessTracker.md)

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L56)

Shared with the host, so `Host.drain` can wait for handlers this transport started.
