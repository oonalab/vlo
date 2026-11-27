---
url: /vlo/api/index/interfaces/TaskContext.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / TaskContext

# Interface: TaskContext

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L20)

What a handler gets beside its input: identity of the attempt and the controls for it.

## Properties

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L26)

Attempt number, starting at 1. `${taskId}:${attempt}` is the idempotency key.

***

### runId

> **runId**: `string`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L24)

The run the task belongs to.

***

### signal

> **signal**: `AbortSignal`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L36)

Aborted when the lease is lost, the activity times out, or the worker shuts down.

***

### taskId

> **taskId**: `string`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L22)

Task id, `${run_id}:${step_id}`; stable across attempts.

## Methods

### heartbeat()

> **heartbeat**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L28)

Extends the lease. Rejects once the lease is gone, so a long task can stop.

#### Returns

`Promise`<`void`>

***

### reportUsage()

> **reportUsage**(`usage`): `void`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L34)

Accumulates what this attempt spent. The total travels with the attempt's result, the
kernel banks it, and every reducer event then carries the run's `usage_total`.
Reported on a failed attempt too: tokens burned before a throw are still spent.

#### Parameters

##### usage

[`UsageInput`](../../host/interfaces/UsageInput.md)

#### Returns

`void`
