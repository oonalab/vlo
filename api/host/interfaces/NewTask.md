---
url: /vlo/api/host/interfaces/NewTask.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / NewTask

# Interface: NewTask

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L35)

A task row to insert: the outbox entry a worker will receive.

## Properties

### activity

> **activity**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L43)

Activity name.

***

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L41)

Attempt number, starting at 1.

***

### idempotency_key

> **idempotency_key**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L51)

Idempotency key the worker echoes so a duplicate push is harmless.

***

### input

> **input**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L49)

Task input.

***

### lease_ttl_ms

> **lease_ttl_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L55)

Lease duration in milliseconds; the reaper reclaims a task past it.

***

### queue

> **queue**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L45)

Queue the task is pushed to or polled from.

***

### retry

> **retry**: [`RetryPolicy`](../../index/interfaces/RetryPolicy.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L53)

Retry policy the host applies on failure.

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L47)

Schema reference for input validation, when the activity declares one.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L39)

Step id inside the run.

***

### task_id

> **task_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L37)

Deterministic task id, derived from run, step and attempt.

***

### timeout_ms?

> `optional` **timeout_ms?**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:57](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L57)

Execution timeout in milliseconds; absent means no timeout.
