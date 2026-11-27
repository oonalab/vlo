---
url: /vlo/api/host/interfaces/PrepareEventInput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PrepareEventInput

# Interface: PrepareEventInput

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L43)

Input of `prepareEvent`.

## Properties

### event

> **event**: [`EventInput`](EventInput.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L54)

The event to apply.

***

### kernel_state?

> `optional` **kernel_state?**: [`KernelState`](KernelState.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L47)

Kernel state at the current checkpoint; absent before `started`.

***

### run

> **run**: [`RunRef`](RunRef.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L45)

The run row.

***

### state?

> `optional` **state?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L52)

The current user-state checkpoint, byte-exact. Lifecycle transitions echo and hash
it without calling the reducer, so pass it for any event that is not `started`.
