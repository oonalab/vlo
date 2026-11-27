---
url: /vlo/api/host/interfaces/Rebuilt.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Rebuilt

# Interface: Rebuilt

Defined in: [sdk/ts/sdk/src/host/refold.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L28)

A checkpoint rebuilt from the journal by [rebuildCheckpoint](../functions/rebuildCheckpoint.md).

## Properties

### kernelState

> **kernelState**: [`KernelState`](KernelState.md)

Defined in: [sdk/ts/sdk/src/host/refold.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L30)

Kernel-owned state after the last input event.

***

### seq

> **seq**: `number`

Defined in: [sdk/ts/sdk/src/host/refold.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L36)

Seq of the last event folded.

***

### state

> **state**: `string`

Defined in: [sdk/ts/sdk/src/host/refold.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L32)

User state after the last input event, byte-exact JSON text.

***

### stateHash

> **stateHash**: `string`

Defined in: [sdk/ts/sdk/src/host/refold.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L34)

Hash of the pair above, equal to the last journaled `state_hash`.

***

### status

> **status**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/host/refold.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/refold.ts#L38)

Run status after the last event folded.
