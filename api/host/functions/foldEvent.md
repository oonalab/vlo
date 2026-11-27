---
url: /vlo/api/host/functions/foldEvent.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / foldEvent

# Function: foldEvent()

> **foldEvent**(`ctx`, `workflow`, `run`, `at`, `event`): [`Transition`](../interfaces/Transition.md)

Defined in: [sdk/ts/sdk/src/host/refold.ts:48](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L48)

One event → one write-set. The reducer runs here and nowhere else. Pure: nothing is
journaled, the caller applies the returned transition.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### workflow

[`Workflow`](../../index/interfaces/Workflow.md)

### run

[`RunRef`](../interfaces/RunRef.md)

### at

[`FoldState`](../interfaces/FoldState.md)

### event

[`EventInput`](../interfaces/EventInput.md)

## Returns

[`Transition`](../interfaces/Transition.md)

## Throws

[ReducerFailed](../classes/ReducerFailed.md) when the workflow's reducer throws; carries the trigger event.

## Throws

[IllegalEvent](../classes/IllegalEvent.md) when the kernel refuses to prepare or reduce the event.
