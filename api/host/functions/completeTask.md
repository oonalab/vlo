---
url: /vlo/api/host/functions/completeTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / completeTask

# Function: completeTask()

> **completeTask**(`ctx`, `taskId`, `attempt`, `output`, `usage?`): `Promise`<[`TaskResult`](../interfaces/TaskResult.md)>

Defined in: [sdk/ts/sdk/src/host/worker/complete.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/complete.ts#L34)

Records an attempt's output. Validated against the registered activity's output schema
when there is one; a violation fails the attempt with `schema_violation` and no retry.
The first terminal result for an attempt wins; later ones return `duplicate: true`.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### taskId

`string`

### attempt

`number`

### output

`unknown`

### usage?

[`Usage`](../../index/interfaces/Usage.md)

## Returns

`Promise`<[`TaskResult`](../interfaces/TaskResult.md)>

## Throws

[TaskNotFound](../classes/TaskNotFound.md) when no task has that id.
