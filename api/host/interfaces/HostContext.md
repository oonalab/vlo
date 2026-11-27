---
url: /vlo/api/host/interfaces/HostContext.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / HostContext

# Interface: HostContext

Defined in: [sdk/ts/sdk/src/host/context.ts:96](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L96)

The shared state every host function takes as its first argument. Built by `createHost`.

## Properties

### activities

> **activities**: `Map`<`string`, [`ActivityRegistration`](ActivityRegistration.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:110](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L110)

Registered activities by name.

***

### auth

> **auth**: [`AuthConfig`](AuthConfig.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:118](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L118)

Credentials this host checks and sends.

***

### basePath?

> `optional` **basePath?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:127](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L127)

Path prefix this host is mounted under, normalised to `/api/vlo`. The router strips it
before matching and every URL built from `publicUrl` carries it.

***

### blob

> **blob**: [`BlobStore`](BlobStore.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:100](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L100)

Where payloads over the inline limit are offloaded.

***

### drain?

> `optional` **drain?**: (`options?`) => `Promise`<[`DrainResult`](DrainResult.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:140](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L140)

Ticks until idle. Present only when this process holds the `orchestrator` role.

#### Parameters

##### options?

[`DrainOptions`](DrainOptions.md)

#### Returns

`Promise`<[`DrainResult`](DrainResult.md)>

***

### events

> **events**: `EventEmitter`

Defined in: [sdk/ts/sdk/src/host/context.ts:134](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L134)

In-memory side channel. `emit` carries `cmd.emit` payloads, `warning` carries the
dispatcher's, and `task_scheduled` wakes a long-poll the moment a task is written.

***

### inProcess

> **inProcess**: [`InProcessTracker`](../classes/InProcessTracker.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:142](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L142)

In-process handlers still owing a result; `drain` waits on it between passes.

***

### journal

> **journal**: [`Journal`](Journal.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:98](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L98)

Durable state and task queue.

***

### kernel

> **kernel**: [`Kernel`](Kernel.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:102](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L102)

The wasm kernel. A proxy that throws until `start()` has loaded it.

***

### kick

> **kick**: () => `void`

Defined in: [sdk/ts/sdk/src/host/context.ts:136](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L136)

Set when this process holds the `orchestrator` role.

#### Returns

`void`

***

### namespace

> **namespace**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:106](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L106)

Namespace new runs are created in.

***

### now

> **now**: () => `number`

Defined in: [sdk/ts/sdk/src/host/context.ts:104](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L104)

Clock for journaled timestamps, epoch milliseconds.

#### Returns

`number`

***

### publicUrl?

> `optional` **publicUrl?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:122](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L122)

Base URL other processes can reach this host on; fills `complete_url` on a push.

***

### queues

> **queues**: `Record`<`string`, [`QueueConfig`](QueueConfig.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:116](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L116)

Per-queue delivery configuration.

***

### roles

> **roles**: `ReadonlySet`<[`Role`](../type-aliases/Role.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:120](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L120)

Roles this process holds.

***

### signals

> **signals**: `Map`<`string`, [`SignalRegistration`](SignalRegistration.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:112](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L112)

Registered signals by name.

***

### streamPollMs

> **streamPollMs**: `number`

Defined in: [sdk/ts/sdk/src/host/context.ts:129](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L129)

How often an open SSE stream looks for new journal events.

***

### tick?

> `optional` **tick?**: () => `Promise`<[`TickCounts`](TickCounts.md)>

Defined in: [sdk/ts/sdk/src/host/context.ts:138](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L138)

One dispatcher pass. Present only when this process holds the `orchestrator` role.

#### Returns

`Promise`<[`TickCounts`](TickCounts.md)>

***

### workers

> **workers**: [`Worker`](../../index/interfaces/Worker.md)\[]

Defined in: [sdk/ts/sdk/src/host/context.ts:114](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L114)

Workers this process runs in-process, by the queues they serve.

***

### workflows

> **workflows**: `Map`<`string`, [`Workflow`](../../index/interfaces/Workflow.md)<`unknown`, `unknown`>>

Defined in: [sdk/ts/sdk/src/host/context.ts:108](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L108)

Registered workflows by name.
