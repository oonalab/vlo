---
url: /vlo/api/host/interfaces/RunRef.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RunRef

# Interface: RunRef

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:9](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L9)

The run row as the kernel needs it to prepare or reduce an event.

## Properties

### bundle_digest

> **bundle_digest**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L15)

Digest of the workflow the run pinned when it started.

***

### last_seq

> **last_seq**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L19)

Sequence number of the last journaled event; `0` before `started`.

***

### parent_run_id?

> `optional` **parent_run_id?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L21)

Parent run, for a child run.

***

### parent_step_id?

> `optional` **parent_step_id?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L23)

The parent's `spawn` step, for a child run.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:11](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L11)

Run id.

***

### status

> **status**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L17)

Current run status.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:13](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L13)

Workflow name.
