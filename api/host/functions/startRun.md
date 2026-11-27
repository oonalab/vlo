---
url: /vlo/api/host/functions/startRun.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / startRun

# Function: startRun()

> **startRun**(`ctx`, `opts`): `Promise`<{ `run_id`: `string`; }>

Defined in: [sdk/ts/sdk/src/host/runs.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L71)

Writes a `created` run row and kicks the dispatcher; the `started` event is folded by the
outbox. Idempotent on `runId`. Runs on a host with the `api` role.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### opts

[`StartRunInput`](../interfaces/StartRunInput.md)

## Returns

`Promise`<{ `run_id`: `string`; }>

## Throws

[WorkflowRejected](../classes/WorkflowRejected.md) when the workflow is not registered.
