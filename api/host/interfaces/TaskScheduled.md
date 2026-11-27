---
url: /vlo/api/host/interfaces/TaskScheduled.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskScheduled

# Interface: TaskScheduled

Defined in: [sdk/ts/sdk/src/host/context.ts:146](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L146)

The `task_scheduled` payload: enough for a poller to tell whether it cares.

## Properties

### queue

> **queue**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:152](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L152)

The queue it was scheduled on.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:148](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L148)

The run the task belongs to.

***

### task_id

> **task_id**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:150](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L150)

The scheduled task.
