---
url: /vlo/api/host/interfaces/Journal.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Journal

# Interface: Journal

Defined in: [sdk/ts/sdk/src/journal/types.ts:286](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L286)

Reads outside a transaction, plus the transaction entry point.

## Methods

### close()

> **close**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:313](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L313)

Releases the connection(s). Idempotent; every call afterwards throws [JournalClosed](../classes/JournalClosed.md).

#### Returns

`Promise`<`void`>

***

### dueTimers()

> **dueTimers**(`nowMs`, `limit`): `Promise`<[`TimerRow`](TimerRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:304](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L304)

Unfired timers with `fire_at_ms <= nowMs`. Read-only; the dispatcher claims via `claimDueTimers`.

#### Parameters

##### nowMs

`number`

##### limit

`number`

#### Returns

`Promise`<[`TimerRow`](TimerRow.md)\[]>

***

### expiredLeases()

> **expiredLeases**(`nowMs`, `limit`): `Promise`<[`TaskRow`](TaskRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:306](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L306)

Running attempts whose `lease_until_ms` has passed.

#### Parameters

##### nowMs

`number`

##### limit

`number`

#### Returns

`Promise`<[`TaskRow`](TaskRow.md)\[]>

***

### expiredTimeouts()

> **expiredTimeouts**(`nowMs`, `limit`): `Promise`<[`TaskRow`](TaskRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:311](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L311)

Running attempts past their `timeout_ms`. The backstop for a worker that never answers:
the worker's own timer covers the case where it is alive enough to report.

#### Parameters

##### nowMs

`number`

##### limit

`number`

#### Returns

`Promise`<[`TaskRow`](TaskRow.md)\[]>

***

### getRun()

> **getRun**(`runId`): `Promise`<[`RunRow`](RunRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:294](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L294)

The run row, or null.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`RunRow`](RunRow.md) | `null`>

***

### getState()

> **getState**(`runId`): `Promise`<[`StateRow`](StateRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:296](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L296)

The run's checkpoint, or null before its first fold.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`StateRow`](StateRow.md) | `null`>

***

### getTask()

> **getTask**(`taskId`): `Promise`<[`TaskRow`](TaskRow.md) | `null`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:298](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L298)

The task row, or null.

#### Parameters

##### taskId

`string`

#### Returns

`Promise`<[`TaskRow`](TaskRow.md) | `null`>

***

### listTasks()

> **listTasks**(`runId`): `Promise`<[`TaskRow`](TaskRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:300](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L300)

Every task of a run.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`TaskRow`](TaskRow.md)\[]>

***

### migrate()

> **migrate**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:288](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L288)

Idempotent, safe to run from several processes at once.

#### Returns

`Promise`<`void`>

***

### query()

> **query**(`q`): `Promise`<[`RunRow`](RunRow.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:302](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L302)

Runs matching the query.

#### Parameters

##### q

[`RunQuery`](RunQuery.md)

#### Returns

`Promise`<[`RunRow`](RunRow.md)\[]>

***

### readEvents()

> **readEvents**(`runId`, `sinceSeq?`): `Promise`<[`Envelope`](Envelope.md)\[]>

Defined in: [sdk/ts/sdk/src/journal/types.ts:292](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L292)

Events with `seq > sinceSeq`, ascending.

#### Parameters

##### runId

`string`

##### sinceSeq?

`number`

#### Returns

`Promise`<[`Envelope`](Envelope.md)\[]>

***

### transaction()

> **transaction**<`T`>(`fn`): `Promise`<`T`>

Defined in: [sdk/ts/sdk/src/journal/types.ts:290](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L290)

Runs `fn` in one transaction: committed when it resolves, rolled back when it rejects.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

(`tx`) => `Promise`<`T`>

#### Returns

`Promise`<`T`>
