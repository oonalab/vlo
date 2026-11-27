---
url: /vlo/api/host/functions/remoteReporter.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / remoteReporter

# Function: remoteReporter()

> **remoteReporter**(`completeUrl`, `token`, `fetchImpl?`): [`TaskReporter`](../interfaces/TaskReporter.md)

Defined in: [sdk/ts/sdk/src/host/worker/reporters.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/reporters.ts#L30)

Reports over HTTP to the host that owns the task. `completeUrl` is the task's base URL
(`…/v1/tasks/{id}`); the three verbs hang off it. Each call has a 10 s timeout and throws
a plain `Error` on a non-2xx answer, which for `heartbeat` is how a lost lease surfaces.

## Parameters

### completeUrl

`string`

### token

`string` | `undefined`

### fetchImpl?

[`FetchLike`](../type-aliases/FetchLike.md) = `globalThis.fetch`

## Returns

[`TaskReporter`](../interfaces/TaskReporter.md)
