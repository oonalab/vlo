---
url: /vlo/api/host/type-aliases/KernelResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / KernelResult

# Type Alias: KernelResult\<T>

> **KernelResult**<`T`> = { `ok`: `true`; `value`: `T`; } | { `error`: [`KernelError`](../interfaces/KernelError.md); `ok`: `false`; }

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:40](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L40)

Every kernel call returns either a value or a [KernelError](../interfaces/KernelError.md).

## Type Parameters

### T

`T`
