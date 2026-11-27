---
url: /vlo/api/host/functions/listRuns.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / listRuns

# Function: listRuns()

> **listRuns**(`ctx`, `query`): `Promise`<[`RunView`](../interfaces/RunView.md)\[]>

Defined in: [sdk/ts/sdk/src/host/runs.ts:195](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L195)

Lists runs in the host's namespace unless `query.namespace` says otherwise.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### query

[`RunQuery`](../interfaces/RunQuery.md)

## Returns

`Promise`<[`RunView`](../interfaces/RunView.md)\[]>
