---
url: /vlo/api/host/functions/rebuildCheckpoint.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / rebuildCheckpoint

# Function: rebuildCheckpoint()

> **rebuildCheckpoint**(`ctx`, `workflow`, `run`, `events`): [`Rebuilt`](../interfaces/Rebuilt.md)

Defined in: [sdk/ts/sdk/src/host/refold.ts:103](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L103)

Replays every input event in the journal. Kernel outputs (scheduled tasks, signal waits,
the `complete` marker) are recomputed, never re-fed.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### workflow

[`Workflow`](../../index/interfaces/Workflow.md)

### run

[`RunRow`](../interfaces/RunRow.md)

### events

readonly [`Envelope`](../interfaces/Envelope.md)\[]

## Returns

[`Rebuilt`](../interfaces/Rebuilt.md)

## Throws

[Nondeterminism](../classes/Nondeterminism.md) at the first event whose replayed `seq` or `state_hash`
differs from the journaled one, or when `events` holds nothing foldable.
