---
url: /vlo/api/host/interfaces/TaskRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskRow

# Interface: TaskRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L89)

One row of `tasks`: a scheduled activity attempt and its outbox and lease bookkeeping.

## Properties

### activity

> **activity**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:99](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L99)

Activity name.

***

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L97)

Current attempt, starting at 1.

***

### created_at_ms

> **created_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:133](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L133)

Row creation, epoch milliseconds.

***

### dispatch_attempts

> **dispatch_attempts**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:119](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L119)

Pushes tried for this attempt; drives the backoff.

***

### dispatch_claimed_until_ms?

> `optional` **dispatch_claimed_until_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:121](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L121)

Outbox claim held by the push stage, epoch milliseconds.

***

### dispatched_at_ms?

> `optional` **dispatched_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:117](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L117)

When this attempt was handed to a worker, epoch milliseconds.

***

### heartbeat_at_ms?

> `optional` **heartbeat_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:131](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L131)

Last heartbeat, epoch milliseconds.

***

### idempotency_key

> **idempotency_key**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:113](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L113)

Stable per attempt; the worker dedupes on it.

***

### input?

> `optional` **input?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:105](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L105)

Inline input, byte-exact JSON.

***

### input_ref?

> `optional` **input_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:107](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L107)

Blob reference for an offloaded input.

***

### lease_ttl_ms

> **lease_ttl_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:123](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L123)

Lease length in milliseconds; a heartbeat extends the lease by this much.

***

### lease_until_ms?

> `optional` **lease_until_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:127](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L127)

When the current lease lapses, epoch milliseconds.

***

### not_before_ms

> **not_before_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:115](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L115)

Earliest dispatch time, epoch milliseconds; pushed back by retries and deferrals.

***

### queue

> **queue**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:103](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L103)

Queue the task is delivered on.

***

### retry_policy

> **retry_policy**: [`RetryPolicy`](../../index/interfaces/RetryPolicy.md)

Defined in: [sdk/ts/sdk/src/journal/types.ts:109](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L109)

Retry policy the kernel plans retries with.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L93)

The run that scheduled it.

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:101](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L101)

Registered schema version the output is checked against.

***

### status

> **status**: [`Status`](../../index/type-aliases/Status.md)

Defined in: [sdk/ts/sdk/src/journal/types.ts:111](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L111)

Task status: `scheduled`, `running`, `retrying`, `succeeded`, `failed` or `cancelled`.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L95)

The workflow step.

***

### task_id

> **task_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:91](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L91)

Primary key, derived by the kernel from `(run_id, step_id)`.

***

### timeout_ms?

> `optional` **timeout_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:125](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L125)

Wall-clock budget for one attempt, measured from `dispatched_at_ms`.

***

### updated_at_ms

> **updated_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:135](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L135)

Last change, epoch milliseconds.

***

### worker_id?

> `optional` **worker_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:129](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L129)

Worker id recorded at dispatch.
