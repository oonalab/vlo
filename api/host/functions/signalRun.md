---
url: /vlo/api/host/functions/signalRun.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / signalRun

# Function: signalRun()

> **signalRun**(`ctx`, `runId`, `name`, `payload`): `Promise`<[`SignalRunResult`](../interfaces/SignalRunResult.md)>

Defined in: [sdk/ts/sdk/src/host/runs.ts:116](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L116)

Stores a signal and, when the run is waiting on that name, delivers it in the same
transaction. Validated against the registered signal schema when there is one. Never
answers 409 for an ended run: the signal is stored and reported as not delivered.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### runId

`string`

### name

`string`

### payload

[`Json`](../../index/type-aliases/Json.md)

## Returns

`Promise`<[`SignalRunResult`](../interfaces/SignalRunResult.md)>

## Throws

[BadRequest](../classes/BadRequest.md) when the payload fails the schema.

## Throws

[RunNotFound](../classes/RunNotFound.md) when no run has that id.
