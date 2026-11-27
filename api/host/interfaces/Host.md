---
url: /vlo/api/host/interfaces/Host.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Host

# Interface: Host

Defined in: [sdk/ts/sdk/src/host/roles.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L93)

A running (or startable) host: the fetch handler plus the controls a process owner needs.

## Properties

### events

> `readonly` **events**: `EventEmitter`

Defined in: [sdk/ts/sdk/src/host/roles.ts:111](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L111)

In-memory side channel: `emit` (from `cmd.emit`), `warning` (dispatcher) and `task_scheduled`.

***

### fetch

> `readonly` **fetch**: [`FetchHandler`](../type-aliases/FetchHandler.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L95)

The HTTP surface as a `(Request) => Response`. Starts the host on first call.

***

### journal

> `readonly` **journal**: [`Journal`](Journal.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:113](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L113)

The journal this host reads and writes.

***

### publicUrl

> **publicUrl**: `string` | `undefined`

Defined in: [sdk/ts/sdk/src/host/roles.ts:117](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L117)

Base URL peers reach this host on. Settable, so [serve](../functions/serve.md) can fill it after binding a port.

***

### roles

> `readonly` **roles**: `ReadonlySet`<[`Role`](../type-aliases/Role.md)>

Defined in: [sdk/ts/sdk/src/host/roles.ts:115](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L115)

Roles this process holds.

## Methods

### drain()

> **drain**(`options?`): `Promise`<[`DrainResult`](DrainResult.md)>

Defined in: [sdk/ts/sdk/src/host/roles.ts:109](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L109)

Ticks until the outbox is idle or `maxMs` (default 25 s) runs out. Concurrent callers
share one drain. Rejects on a host without the `orchestrator` role.

#### Parameters

##### options?

[`DrainOptions`](DrainOptions.md)

#### Returns

`Promise`<[`DrainResult`](DrainResult.md)>

***

### start()

> **start**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/roles.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L97)

Loads the kernel, migrates the journal and starts the dispatcher. Idempotent.

#### Returns

`Promise`<`void`>

***

### stop()

> **stop**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/roles.ts:102](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L102)

Stops the dispatcher, waits up to [SHUTDOWN_GRACE_MS](../variables/SHUTDOWN_GRACE_MS.md) for in-process handlers, then
closes the journal if the host opened it from a URL. Idempotent.

#### Returns

`Promise`<`void`>

***

### tick()

> **tick**(): `Promise`<[`TickCounts`](TickCounts.md)>

Defined in: [sdk/ts/sdk/src/host/roles.ts:104](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L104)

One dispatcher pass. Rejects on a host without the `orchestrator` role.

#### Returns

`Promise`<[`TickCounts`](TickCounts.md)>
