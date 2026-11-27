---
url: /vlo/api/host/interfaces/KernelError.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / KernelError

# Interface: KernelError

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L28)

An error returned by the kernel; errors are values, never exceptions.

## Properties

### code

> **code**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L30)

One of the kernel's closed set of error codes.

***

### message

> **message**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L32)

Human-readable detail.

***

### seq?

> `optional` **seq?**: `number`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L34)

Sequence number the error concerns, when there is one.

***

### step_id?

> `optional` **step_id?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L36)

Step id the error concerns, when there is one.
