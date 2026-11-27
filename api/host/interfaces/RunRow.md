---
url: /vlo/api/host/interfaces/RunRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RunRow

# Interface: RunRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L21)

One row of `runs`.

## Properties

### assignee?

> `optional` **assignee?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L53)

Free-form assignee, for human-facing queues. Unused by the host.

***

### closed_at_ms?

> `optional` **closed_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L61)

When the run reached a terminal status, epoch milliseconds.

***

### component_digest

> **component_digest**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L29)

Digest of the workflow bundle the run was started with; a checkpoint from another digest is rebuilt.

***

### continued_from?

> `optional` **continued_from?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L39)

The run this one continued from (`continue_as_new`).

***

### continued_to?

> `optional` **continued_to?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L41)

The successor run a `continued` run handed its input to; set with the `continue` marker.

***

### created_at_ms

> **created_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L55)

Row creation, epoch milliseconds.

***

### input?

> `optional` **input?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L43)

Inline start input, byte-exact JSON.

***

### input_ref?

> `optional` **input_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L45)

Blob reference for an offloaded start input.

***

### last_seq

> **last_seq**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L33)

Seq of the last journaled event; 0 before `started`.

***

### namespace

> **namespace**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:25](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L25)

Namespace the run was created in.

***

### notify_claimed_until_ms?

> `optional` **notify_claimed_until_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L67)

Outbox claim held by the "notify parents" stage.

***

### output?

> `optional` **output?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L47)

Inline completion output, byte-exact JSON.

***

### output_ref?

> `optional` **output_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L49)

Blob reference for an offloaded completion output.

***

### parent_notified_at_ms?

> `optional` **parent_notified_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L63)

When the parent received this child's `child` event, epoch milliseconds.

***

### parent_run_id?

> `optional` **parent_run_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L35)

Parent run, for a spawned child.

***

### parent_step_id?

> `optional` **parent_step_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L37)

The parent's step that spawned this run.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L23)

Primary key.

***

### search

> **search**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/journal/types.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L51)

Caller-supplied search attributes.

***

### start_claimed_until_ms?

> `optional` **start_claimed_until_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L65)

Outbox claim held by the "start runs" stage.

***

### started_at_ms?

> `optional` **started_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L59)

When the `started` event was folded, epoch milliseconds.

***

### status

> **status**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/journal/types.ts:31](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L31)

Current status.

***

### updated_at_ms

> **updated_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:57](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L57)

Last change, epoch milliseconds.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L27)

Workflow name.
