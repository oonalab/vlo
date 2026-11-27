---
url: /vlo/api/host/interfaces/Kernel.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Kernel

# Interface: Kernel

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:164](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L164)

The kernel as the host sees it. Implemented by the wasm loader (`load.ts`) and by a
test double. Every method is synchronous and pure.

## Methods

### deriveIds()

> **deriveIds**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<[`DeriveIdsOutput`](DeriveIdsOutput.md)>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:180](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L180)

Deterministic task id, idempotency key and child run id for a step attempt.

#### Parameters

##### input

###### attempt

`number`

###### run_id

`string`

###### step_id

`string`

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<[`DeriveIdsOutput`](DeriveIdsOutput.md)>

***

### planRetry()

> **planRetry**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<[`RetryPlan`](../type-aliases/RetryPlan.md)>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:176](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L176)

Whether and when to retry an attempt, from the policy, cause and journaled randomness.

#### Parameters

##### input

[`PlanRetryInput`](PlanRetryInput.md)

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<[`RetryPlan`](../type-aliases/RetryPlan.md)>

***

### prepareEvent()

> **prepareEvent**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<[`Prepared`](../type-aliases/Prepared.md)>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:170](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L170)

Classifies an event: call the reducer, or apply a lifecycle transition without it.

#### Parameters

##### input

[`PrepareEventInput`](PrepareEventInput.md)

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<[`Prepared`](../type-aliases/Prepared.md)>

***

### reduceStep()

> **reduceStep**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<[`Transition`](Transition.md)>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:172](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L172)

Validates a reduction's commands and builds the write-set the journal applies.

#### Parameters

##### input

[`ReduceStepInput`](ReduceStepInput.md)

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<[`Transition`](Transition.md)>

***

### refoldCheck()

> **refoldCheck**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<[`RefoldCheckOutput`](../type-aliases/RefoldCheckOutput.md)>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:178](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L178)

Compares a re-fold's hashes with the journal's and names the first divergent seq.

#### Parameters

##### input

###### actual

[`HashAtSeq`](HashAtSeq.md)\[]

###### expected

[`HashAtSeq`](HashAtSeq.md)\[]

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<[`RefoldCheckOutput`](../type-aliases/RefoldCheckOutput.md)>

***

### stateHash()

> **stateHash**(`input`): [`KernelResult`](../type-aliases/KernelResult.md)<{ `hash`: `string`; }>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:174](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L174)

Hash of kernel state plus user state, as stored on every checkpoint and event.

#### Parameters

##### input

###### kernel_state

[`KernelState`](KernelState.md)

###### state

`string`

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<{ `hash`: `string`; }>

***

### validateEvent()

> **validateEvent**(`event`): [`KernelResult`](../type-aliases/KernelResult.md)<{ `normalized`: [`EventInput`](EventInput.md); }>

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:168](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L168)

Field and enum checks on an envelope, returning the normalised form.

#### Parameters

##### event

[`EventInput`](EventInput.md)

#### Returns

[`KernelResult`](../type-aliases/KernelResult.md)<{ `normalized`: [`EventInput`](EventInput.md); }>

***

### version()

> **version**(): [`KernelVersion`](KernelVersion.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:166](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L166)

Kernel build, protocol number and feature flags; the host refuses a protocol mismatch.

#### Returns

[`KernelVersion`](KernelVersion.md)
