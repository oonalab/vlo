---
url: /vlo/api/host/interfaces/ReduceStepInput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ReduceStepInput

# Interface: ReduceStepInput

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L77)

Input of `reduceStep`: the reducer's output, to be validated and turned into a write-set.

## Properties

### event

> **event**: [`EventInput`](EventInput.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L83)

The event that was reduced.

***

### kernel_state

> **kernel_state**: [`KernelState`](KernelState.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L81)

Kernel state the reducer ran against.

***

### reduction

> **reduction**: [`KernelReduction`](KernelReduction.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L85)

What the reducer returned.

***

### run

> **run**: [`RunRef`](RunRef.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L79)

The run row.
