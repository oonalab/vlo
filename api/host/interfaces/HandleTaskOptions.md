---
url: /vlo/api/host/interfaces/HandleTaskOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / HandleTaskOptions

# Interface: HandleTaskOptions

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L33)

Knobs for [handleTask](../functions/handleTask.md).

## Properties

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [sdk/ts/sdk/src/host/worker/handle-task.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/handle-task.ts#L35)

The worker's own lifetime. Aborting it tells in-flight handlers to stop.
