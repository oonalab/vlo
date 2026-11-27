---
url: /vlo/api/host/functions/localReporter.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / localReporter

# Function: localReporter()

> **localReporter**(`ctx`): [`TaskReporter`](../interfaces/TaskReporter.md)

Defined in: [sdk/ts/sdk/src/host/worker/reporters.ts:8](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/reporters.ts#L8)

Reports straight into this host's journal via [completeTask](completeTask.md), [failTask](failTask.md) and [heartbeatTask](heartbeatTask.md).

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

## Returns

[`TaskReporter`](../interfaces/TaskReporter.md)
