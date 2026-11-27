---
url: /vlo/api/host/functions/applyEvent.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / applyEvent

# Function: applyEvent()

> **applyEvent**(`ctx`, `runId`, `source`, `after?`): `Promise`<[`TxOutcome`](../interfaces/TxOutcome.md)>

Defined in: [sdk/ts/sdk/src/host/transition.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L81)

Submits one event. Owns its transaction, recovers a reducer throw or a divergence into
the matching marker, then runs the post-commit work (buffered signals, emits, kick).

A `ReducerFailed` is swallowed: the run is failed with an `app_error` marker and that
outcome is returned. A `Nondeterminism` is recorded as a marker and then rethrown.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### runId

`string`

### source

[`EventSource`](../type-aliases/EventSource.md)

### after?

[`AfterApply`](../type-aliases/AfterApply.md)

## Returns

`Promise`<[`TxOutcome`](../interfaces/TxOutcome.md)>

## Throws

[RunNotFound](../classes/RunNotFound.md) when no run has that id.

## Throws

[RunTerminal](../classes/RunTerminal.md) when the run ended and the event is not a task result or a closing marker.

## Throws

[WorkflowRejected](../classes/WorkflowRejected.md) when the run's workflow is not registered on this host.

## Throws

[IllegalEvent](../classes/IllegalEvent.md) when the kernel refuses the event for a reason other than a duplicate.

## Throws

[Nondeterminism](../classes/Nondeterminism.md) after journaling the divergence.
