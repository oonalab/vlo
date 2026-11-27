---
url: /vlo/api/host/functions/failTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / failTask

# Function: failTask()

> **failTask**(`ctx`, `taskId`, `attempt`, `error`, `retryable?`, `cause?`, `usage?`): `Promise`<[`TaskResult`](../interfaces/TaskResult.md)>

Defined in: [sdk/ts/sdk/src/host/worker/complete.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/complete.ts#L65)

Records an attempt's failure: a `retrying` event when `retryable` and the kernel's retry
plan allows another attempt, otherwise a `failed` event. The first terminal result for an
attempt wins; later ones return `duplicate: true`.

`cause` names who lost the attempt: the handler by default, the reaper on a dead lease.
`usage` is banked whichever way the attempt ends — tokens burned before a throw are spent.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### taskId

`string`

### attempt

`number`

### error

`string`

### retryable?

`boolean` = `true`

### cause?

[`Cause`](../../index/type-aliases/Cause.md) = `"app_error"`

### usage?

[`Usage`](../../index/interfaces/Usage.md)

## Returns

`Promise`<[`TaskResult`](../interfaces/TaskResult.md)>

## Throws

[TaskNotFound](../classes/TaskNotFound.md) when no task has that id.
