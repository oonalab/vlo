---
url: /vlo/api/host/interfaces/JournalTx.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / JournalTx

# Interface: JournalTx

Defined in: [sdk/ts/sdk/src/journal/types.ts:336](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L336)

One transaction. Every method is serialised against the run it touches.

## Methods

### applyTransition()

> **applyTransition**(`runId`, `t`, `opts`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:350](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L350)

Applies a kernel write-set atomically: events (seq taken from each envelope,
with the `(run_id, seq)` primary key as the backstop), the checkpoint, new
tasks, task updates, timers, signal waits, child runs, the successor run and the run row.

#### Parameters

##### runId

`string`

##### t

[`Transition`](Transition.md)

##### opts

[`ApplyTransitionOptions`](ApplyTransitionOptions.md)

#### Returns

`Promise`<`void`>

***

### claimClosedUnnotified()

> **claimClosedUnnotified**(`nowMs`, `limit`, `holdMs`): `Promise`<[`RunRow`](RunRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:375](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L375)

Closed child runs whose parent has not been told yet, claimed for `holdMs`.

#### Parameters

##### nowMs

`number`

##### limit

`number`

##### holdMs

`number`

#### Returns

`Promise`<[`RunRow`](RunRow.md)\[]>

***

### claimCreatedRuns()

> **claimCreatedRuns**(`nowMs`, `limit`, `holdMs`): `Promise`<[`RunRow`](RunRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:373](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L373)

`created` runs not yet started, claimed for `holdMs`; concurrent claimers get disjoint sets.

#### Parameters

##### nowMs

`number`

##### limit

`number`

##### holdMs

`number`

#### Returns

`Promise`<[`RunRow`](RunRow.md)\[]>

***

### claimDueTimers()

> **claimDueTimers**(`nowMs`, `limit`, `holdMs`): `Promise`<[`TimerRow`](TimerRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:381](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L381)

Due, unfired timers, claimed for `holdMs`; concurrent claimers get disjoint sets.

#### Parameters

##### nowMs

`number`

##### limit

`number`

##### holdMs

`number`

#### Returns

`Promise`<[`TimerRow`](TimerRow.md)\[]>

***

### claimUndispatchedTasks()

> **claimUndispatchedTasks**(`nowMs`, `limit`, `holdMs`, `filter?`): `Promise`<[`TaskRow`](TaskRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:354](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L354)

Claims schedulable, undispatched tasks for `holdMs`; concurrent claimers get disjoint sets.

#### Parameters

##### nowMs

`number`

##### limit

`number`

##### holdMs

`number`

##### filter?

[`TaskClaimFilter`](TaskClaimFilter.md)

#### Returns

`Promise`<[`TaskRow`](TaskRow.md)\[]>

***

### createRun()

> **createRun**(`row`, `nowMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:340](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L340)

Idempotent on `run_id`.

#### Parameters

##### row

[`NewRunRow`](NewRunRow.md)

##### nowMs

`number`

#### Returns

`Promise`<`void`>

***

### deferDispatch()

> **deferDispatch**(`taskId`, `attempt`, `notBeforeMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:369](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L369)

Releases the dispatch claim and backs the task off to `notBeforeMs`.

#### Parameters

##### taskId

`string`

##### attempt

`number`

##### notBeforeMs

`number`

#### Returns

`Promise`<`void`>

***

### getSchema()

> **getSchema**(`name`, `version`): `Promise`<[`SchemaRow`](SchemaRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:399](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L399)

The schema row, or null.

#### Parameters

##### name

`string`

##### version

`string`

#### Returns

`Promise`<[`SchemaRow`](SchemaRow.md) | `null`>

***

### getSignalWaits()

> **getSignalWaits**(`runId`): `Promise`<[`SignalWaitRow`](SignalWaitRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:391](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L391)

Steps of the run currently parked on a signal.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`SignalWaitRow`](SignalWaitRow.md)\[]>

***

### getState()

> **getState**(`runId`): `Promise`<[`StateRow`](StateRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:342](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L342)

The run's checkpoint, or null before its first fold.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`StateRow`](StateRow.md) | `null`>

***

### heartbeat()

> **heartbeat**(`taskId`, `attempt`, `leaseUntilMs`, `nowMs`): `Promise`<`boolean`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:371](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L371)

False unless the task is running at that attempt.

#### Parameters

##### taskId

`string`

##### attempt

`number`

##### leaseUntilMs

`number`

##### nowMs

`number`

#### Returns

`Promise`<`boolean`>

***

### lockRun()

> **lockRun**(`runId`): `Promise`<[`RunRow`](RunRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:338](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L338)

Takes the per-run write lock for the rest of the transaction, then reads the run.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`RunRow`](RunRow.md) | `null`>

***

### markDispatched()

> **markDispatched**(`taskId`, `attempt`, `nowMs`, `leaseUntilMs`, `workerId?`): `Promise`<`boolean`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:361](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L361)

False when the attempt moved on or the task is no longer scheduled.

#### Parameters

##### taskId

`string`

##### attempt

`number`

##### nowMs

`number`

##### leaseUntilMs

`number`

##### workerId?

`string`

#### Returns

`Promise`<`boolean`>

***

### markParentNotified()

> **markParentNotified**(`runId`, `nowMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:377](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L377)

Sets `parent_notified_at_ms`, so the child is never claimed again.

#### Parameters

##### runId

`string`

##### nowMs

`number`

#### Returns

`Promise`<`void`>

***

### markSignalDelivered()

> **markSignalDelivered**(`signalId`, `stepId`, `nowMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:389](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L389)

Records which step consumed the signal.

#### Parameters

##### signalId

`string`

##### stepId

`string`

##### nowMs

`number`

#### Returns

`Promise`<`void`>

***

### markTimerFired()

> **markTimerFired**(`runId`, `stepId`, `nowMs`): `Promise`<`boolean`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:383](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L383)

False when the timer already fired; timers are deduped by `step_id`.

#### Parameters

##### runId

`string`

##### stepId

`string`

##### nowMs

`number`

#### Returns

`Promise`<`boolean`>

***

### putSignal()

> **putSignal**(`row`, `nowMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:385](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L385)

Stores a signal, undelivered.

#### Parameters

##### row

[`NewSignalRow`](NewSignalRow.md)

##### nowMs

`number`

#### Returns

`Promise`<`void`>

***

### readEvents()

> **readEvents**(`runId`, `sinceSeq?`): `Promise`<[`Envelope`](Envelope.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:344](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L344)

Events with `seq > sinceSeq`, ascending.

#### Parameters

##### runId

`string`

##### sinceSeq?

`number`

#### Returns

`Promise`<[`Envelope`](Envelope.md)\[]>

***

### removeSignalWait()

> **removeSignalWait**(`runId`, `stepId`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:393](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L393)

Drops a wait once its signal was delivered.

#### Parameters

##### runId

`string`

##### stepId

`string`

#### Returns

`Promise`<`void`>

***

### takeSignal()

> **takeSignal**(`runId`, `name`): `Promise`<[`SignalRow`](SignalRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:387](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L387)

Oldest undelivered signal of that name. Does not mark it delivered.

#### Parameters

##### runId

`string`

##### name

`string`

#### Returns

`Promise`<[`SignalRow`](SignalRow.md) | `null`>

***

### upsertSchema()

> **upsertSchema**(`row`, `nowMs`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:397](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L397)

Inserts the schema; a row with the same `(name, version)` is left untouched.

#### Parameters

##### row

[`SchemaRow`](SchemaRow.md)

##### nowMs

`number`

#### Returns

`Promise`<`void`>
