---
url: /vlo/api/host/classes/Dispatcher.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Dispatcher

# Class: Dispatcher

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:102](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L102)

The outbox dispatcher. `createHost` builds one per host holding the `orchestrator` role;
only tests and custom hosts construct it directly.

## Constructors

### Constructor

> **new Dispatcher**(`ctx`, `options?`): `Dispatcher`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:124](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L124)

Reads the options once; nothing runs until [Dispatcher.start](#start).

#### Parameters

##### ctx

[`HostContext`](../interfaces/HostContext.md)

##### options?

[`DispatcherOptions`](../interfaces/DispatcherOptions.md) = `{}`

#### Returns

`Dispatcher`

## Methods

### kick()

> **kick**(): `void`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:170](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L170)

Runs a tick soon. Safe to call from inside a tick: it queues one more pass.

#### Returns

`void`

***

### start()

> **start**(): `void`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:147](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L147)

Begins ticking (`loop` mode) or merely arms `tick()` (`manual` mode). Idempotent.

#### Returns

`void`

***

### stop()

> **stop**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:161](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L161)

Stops ticking and waits for every pass still in flight. The wait is what makes shutdown
safe: the host closes the journal next, and a stage halfway through a claim must not be
left reading a connection that is gone.

#### Returns

`Promise`<`void`>

***

### tick()

> **tick**(): `Promise`<[`TickCounts`](../interfaces/TickCounts.md)>

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:176](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L176)

One pass over every stage. The tick route and the tests drive the outbox with it.

#### Returns

`Promise`<[`TickCounts`](../interfaces/TickCounts.md)>
