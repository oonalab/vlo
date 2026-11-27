---
url: /vlo/api/host/interfaces/KernelVersion.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / KernelVersion

# Interface: KernelVersion

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L18)

Kernel build information; the host refuses a protocol number it does not speak.

## Properties

### features

> **features**: `string`\[]

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L24)

Feature flags the build supports.

***

### protocol

> **protocol**: `number`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L22)

Protocol number.

***

### version

> **version**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L20)

Kernel crate version.
