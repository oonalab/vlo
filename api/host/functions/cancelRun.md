---
url: /vlo/api/host/functions/cancelRun.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / cancelRun

# Function: cancelRun()

> **cancelRun**(`ctx`, `runId`): `Promise`<[`RunView`](../interfaces/RunView.md)>

Defined in: [sdk/ts/sdk/src/host/runs.ts:178](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L178)

Folds a `cancel` marker and returns the run. Cancelling an ended run is a no-op that
still returns the view.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### runId

`string`

## Returns

`Promise`<[`RunView`](../interfaces/RunView.md)>

## Throws

[RunNotFound](../classes/RunNotFound.md) when no run has that id.
