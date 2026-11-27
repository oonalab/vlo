---
url: /vlo/api/index/interfaces/TaskOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / TaskOptions

# Interface: TaskOptions

Defined in: [sdk/ts/sdk/src/core/commands.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L24)

Per-call overrides for `cmd.task`.

## Properties

### id?

> `optional` **id?**: `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L26)

Step id. Defaults to a kernel-derived id; set it when a phase fans out.

***

### queue?

> `optional` **queue?**: `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L28)

Queue for this task only. Defaults to the activity's `queue`.
