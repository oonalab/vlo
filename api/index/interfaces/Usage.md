---
url: /vlo/api/index/interfaces/Usage.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Usage

# Interface: Usage

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:66](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L66)

Resources an attempt consumed, as banked by the kernel. Integers only, never negative:
the total is hashed into the kernel state.

## Properties

### cost_micro_usd

> **cost_micro_usd**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:72](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L72)

Cost in millionths of a US dollar.

***

### cpu_ms

> **cpu_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:68](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L68)

CPU time in milliseconds.

***

### tokens

> **tokens**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:70](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L70)

Model tokens, prompt and completion together.
