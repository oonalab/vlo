---
url: /vlo/api/host/classes/InProcessTracker.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / InProcessTracker

# Class: InProcessTracker

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L17)

Counts handlers this process still owes a result for. One tracker is shared by every
in-process transport a host builds, because `Host.drain` has to tell "the dispatcher
moved nothing" apart from "the dispatcher moved nothing *yet*: a handler is running and
its result will schedule the next task".

## Constructors

### Constructor

> **new InProcessTracker**(): `InProcessTracker`

#### Returns

`InProcessTracker`

## Accessors

### finished

#### Get Signature

> **get** **finished**(): `number`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L28)

Monotonic count of handlers that reported. A change across a tick means work landed.

##### Returns

`number`

***

### inFlight

#### Get Signature

> **get** **inFlight**(): `number`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L23)

Handlers started and not yet reported.

##### Returns

`number`

## Methods

### enter()

> **enter**(): `void`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L33)

Counts a handler as started.

#### Returns

`void`

***

### leave()

> **leave**(): `void`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L38)

Counts a handler as reported; wakes `settled()` waiters when none are left.

#### Returns

`void`

***

### settled()

> **settled**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L47)

Resolves once no in-process handler is outstanding.

#### Returns

`Promise`<`void`>
