---
url: /vlo/api/host/interfaces/FoldState.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / FoldState

# Interface: FoldState

Defined in: [sdk/ts/sdk/src/host/refold.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L20)

The checkpoint a fold starts from. Both fields are absent before the `started` event.

## Properties

### kernelState?

> `optional` **kernelState?**: [`KernelState`](KernelState.md)

Defined in: [sdk/ts/sdk/src/host/refold.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L22)

Kernel-owned state at the checkpoint.

***

### state?

> `optional` **state?**: `string`

Defined in: [sdk/ts/sdk/src/host/refold.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L24)

User state at the checkpoint, byte-exact JSON text.
