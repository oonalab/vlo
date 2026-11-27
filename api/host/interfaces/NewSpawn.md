---
url: /vlo/api/host/interfaces/NewSpawn.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / NewSpawn

# Interface: NewSpawn

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L81)

A child run to start.

## Properties

### child_run_id

> **child_run_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L85)

Deterministic id of the child run.

***

### input

> **input**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L89)

The child's start input.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L83)

The parent's step id.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L87)

Workflow the child runs.
