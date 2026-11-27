---
url: /vlo/api/host/functions/heartbeatTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / heartbeatTask

# Function: heartbeatTask()

> **heartbeatTask**(`ctx`, `taskId`, `attempt`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/complete.ts:119](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/complete.ts#L119)

Extends the attempt's lease by the task's `lease_ttl_ms` from now.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### taskId

`string`

### attempt

`number`

## Returns

`Promise`<`void`>

## Throws

[TaskNotFound](../classes/TaskNotFound.md) when no task has that id.

## Throws

[LeaseLost](../classes/LeaseLost.md) when the task is not running at that attempt any more.
