---
url: /vlo/api/host/interfaces/TaskReporter.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskReporter

# Interface: TaskReporter

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:16](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L16)

Where a result goes: back into this process, or over HTTP to the host that pushed.

## Methods

### complete()

> **complete**(`taskId`, `attempt`, `output`, `usage?`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L18)

Reports the attempt's output.

#### Parameters

##### taskId

`string`

##### attempt

`number`

##### output

`unknown`

##### usage?

[`Usage`](../../index/interfaces/Usage.md)

#### Returns

`Promise`<`void`>

***

### fail()

> **fail**(`taskId`, `attempt`, `error`, `retryable`, `usage?`, `cause?`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L20)

Reports a failure; `retryable: false` skips the retry policy. `cause` defaults to `app_error`.

#### Parameters

##### taskId

`string`

##### attempt

`number`

##### error

`string`

##### retryable

`boolean`

##### usage?

[`Usage`](../../index/interfaces/Usage.md)

##### cause?

[`Cause`](../../index/type-aliases/Cause.md)

#### Returns

`Promise`<`void`>

***

### heartbeat()

> **heartbeat**(`taskId`, `attempt`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L29)

Extends the lease. Rejects once the lease is gone.

#### Parameters

##### taskId

`string`

##### attempt

`number`

#### Returns

`Promise`<`void`>
