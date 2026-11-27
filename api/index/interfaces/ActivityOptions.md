---
url: /vlo/api/index/interfaces/ActivityOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ActivityOptions

# Interface: ActivityOptions\<I, O>

Defined in: [sdk/ts/sdk/src/core/activity.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L67)

What [activity](../functions/activity.md) needs: the two Zod schemas plus optional dispatch knobs.

## Type Parameters

### I

`I` *extends* `z.ZodType`

### O

`O` *extends* `z.ZodType`

## Properties

### input

> **input**: `I`

Defined in: [sdk/ts/sdk/src/core/activity.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L69)

Schema of the task input. `cmd.task` validates against it before the command leaves the reducer.

***

### leaseMs?

> `optional` **leaseMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L77)

Lease a worker holds on an attempt before it must heartbeat, in milliseconds. Default [DEFAULT_LEASE_MS](../variables/DEFAULT_LEASE_MS.md). Outside the content hash.

***

### output

> **output**: `O`

Defined in: [sdk/ts/sdk/src/core/activity.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L71)

Schema of the handler's return value. The host validates against it before folding `task_done`.

***

### queue?

> `optional` **queue?**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:75](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L75)

Queue the task is dispatched on. Default [DEFAULT_QUEUE](../variables/DEFAULT_QUEUE.md). Outside the content hash.

***

### retry?

> `optional` **retry?**: [`RetryOptions`](RetryOptions.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L73)

Retry policy; see [RetryOptions](RetryOptions.md). Part of the content hash. Default [DEFAULT_RETRY](../variables/DEFAULT_RETRY.md).

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L85)

Wall-clock budget for one attempt. The worker aborts the handler at it and reports
`cause: "timeout"`; the host reaps the attempt if the worker never answers at all.

Deliberately outside the content hash: a timeout is an operational knob, not part of the
activity's contract, so tuning it must not version the schema out from under live runs.
