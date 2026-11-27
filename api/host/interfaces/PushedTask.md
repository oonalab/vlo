---
url: /vlo/api/host/interfaces/PushedTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PushedTask

# Interface: PushedTask

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:6](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L6)

The task as a worker receives it — the HTTP push body, byte for byte.

## Properties

### activity

> **activity**: `object`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:16](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L16)

Activity name and, when registered, the schema version the output is checked against.

#### name

> **name**: `string`

#### schema_ref?

> `optional` **schema_ref?**: `string`

***

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:14](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L14)

Attempt number, starting at 1. Every report must carry it back.

***

### complete_url?

> `optional` **complete_url?**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L28)

Base URL for `${complete_url}/complete|fail|heartbeat`. Absent for in-process work.

***

### heartbeat_ms

> **heartbeat_ms**: `number`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L24)

How often to heartbeat, in milliseconds: a third of the lease, at least 1 s.

***

### idempotency_key

> **idempotency_key**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L18)

Stable per attempt: a worker that sees it twice is being re-pushed, not asked to run again.

***

### input

> **input**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L20)

The activity input.

***

### lease_ms

> **lease_ms**: `number`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L22)

Lease length in milliseconds; each heartbeat extends it by this much.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:10](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L10)

The run the task belongs to.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:12](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L12)

The workflow step that scheduled it.

***

### task_id

> **task_id**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:8](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L8)

The task's id; the callback URL is built from it.

***

### timeout_ms?

> `optional` **timeout_ms?**: `number`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L26)

Wall-clock budget for this attempt. The worker aborts the handler at it.
