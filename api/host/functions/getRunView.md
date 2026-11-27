---
url: /vlo/api/host/functions/getRunView.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / getRunView

# Function: getRunView()

> **getRunView**(`ctx`, `runId`): `Promise`<[`RunView`](../interfaces/RunView.md)>

Defined in: [sdk/ts/sdk/src/host/runs.ts:188](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L188)

Reads one run, inlining an offloaded output.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### runId

`string`

## Returns

`Promise`<[`RunView`](../interfaces/RunView.md)>

## Throws

[RunNotFound](../classes/RunNotFound.md) when no run has that id.
