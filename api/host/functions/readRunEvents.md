---
url: /vlo/api/host/functions/readRunEvents.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / readRunEvents

# Function: readRunEvents()

> **readRunEvents**(`ctx`, `runId`, `sinceSeq`): `Promise`<[`Envelope`](../interfaces/Envelope.md)\[]>

Defined in: [sdk/ts/sdk/src/host/runs.ts:201](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L201)

Journaled events with `seq > sinceSeq`, ascending. Empty for an unknown run.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### runId

`string`

### sinceSeq

`number`

## Returns

`Promise`<[`Envelope`](../interfaces/Envelope.md)\[]>
