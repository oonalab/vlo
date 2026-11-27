---
url: /vlo/api/host/interfaces/RunView.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RunView

# Interface: RunView

Defined in: [sdk/ts/sdk/src/host/runs.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L18)

A run as the API returns it: the row minus internals, with the output inlined.

## Properties

### cause?

> `optional` **cause?**: [`Cause`](../../index/type-aliases/Cause.md)

Defined in: [sdk/ts/sdk/src/host/runs.ts:48](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L48)

The closing marker's cause (`app_error` or `nondeterminism_detected`). Present with `error`.

***

### closed_at_ms?

> `optional` **closed_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/host/runs.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L36)

When the run reached a terminal status, epoch milliseconds.

***

### continued_from?

> `optional` **continued_from?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:40](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L40)

The run this one continued from, when it was started by a `continue_as_new`.

***

### continued_to?

> `optional` **continued_to?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:42](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L42)

The successor this run handed its input to; set once the run is `continued`.

***

### created_at_ms

> **created_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/host/runs.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L30)

When the row was created, epoch milliseconds.

***

### error?

> `optional` **error?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:46](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L46)

Why the run failed: the `error` of its closing marker. Present only when `status` is `failed`.

***

### last_seq

> **last_seq**: `number`

Defined in: [sdk/ts/sdk/src/host/runs.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L26)

Seq of the last journaled event.

***

### output?

> `optional` **output?**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/host/runs.ts:44](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L44)

Completion output, read back from the blob store when it was offloaded.

***

### parent_run_id?

> `optional` **parent_run_id?**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L38)

The parent run, for a spawned child.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L20)

The run's id.

***

### search

> **search**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/host/runs.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L28)

Caller-supplied search attributes given at start.

***

### started_at_ms?

> `optional` **started_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/host/runs.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L34)

When the `started` event was folded, epoch milliseconds.

***

### status

> **status**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/host/runs.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L24)

Current status.

***

### updated_at_ms

> **updated_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/host/runs.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L32)

When the row last changed, epoch milliseconds.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L22)

Workflow name.
