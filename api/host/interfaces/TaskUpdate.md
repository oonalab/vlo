---
url: /vlo/api/host/interfaces/TaskUpdate.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskUpdate

# Interface: TaskUpdate

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L61)

A status change on an existing task row.

## Properties

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L65)

Attempt the update applies to.

***

### not_before_ms?

> `optional` **not_before_ms?**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L69)

Earliest time in milliseconds the task may run again; set on a retry.

***

### status

> **status**: [`Status`](../../index/type-aliases/Status.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L67)

New task status.

***

### task_id

> **task_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L63)

Task id.
