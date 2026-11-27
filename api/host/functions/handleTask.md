---
url: /vlo/api/host/functions/handleTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / handleTask

# Function: handleTask()

> **handleTask**(`worker`, `task`, `reporter`, `options?`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L45)

Runs one pushed task on a worker and reports exactly one terminal result. Heartbeats every
`heartbeat_ms`; a refused heartbeat, `timeout_ms` elapsing or `options.signal` aborting
all abort the handler's `ctx.signal`. A handler throw is reported as a retryable failure;
a missing handler as a non-retryable one. Resolves once the result was reported, and
rejects only when the reporter itself fails.

## Parameters

### worker

[`Worker`](../../index/interfaces/Worker.md)

### task

[`PushedTask`](../interfaces/PushedTask.md)

### reporter

[`TaskReporter`](../interfaces/TaskReporter.md)

### options?

[`HandleTaskOptions`](../interfaces/HandleTaskOptions.md) = `{}`

## Returns

`Promise`<`void`>
