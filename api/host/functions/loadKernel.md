---
url: /vlo/api/host/functions/loadKernel.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / loadKernel

# Function: loadKernel()

> **loadKernel**(): `Promise`<[`Kernel`](../interfaces/Kernel.md)>

Defined in: [sdk/ts/sdk/src/kernel/load.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/load.ts#L43)

Loads the wasm kernel once per process and returns the same instance afterwards. Looks for
`vlo_kernel_bg.wasm` in the package's `wasm/` directory, or at `VLO_KERNEL_WASM`. Rejects
when the bytes are missing or the kernel speaks a different protocol version.

## Returns

`Promise`<[`Kernel`](../interfaces/Kernel.md)>
