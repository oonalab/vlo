---
url: /vlo/api/host/functions/findWorker.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / findWorker

# Function: findWorker()

> **findWorker**(`workers`, `queue`, `activity`): [`Worker`](../../index/interfaces/Worker.md) | `undefined`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:134](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L134)

The first worker in this process that serves both the queue and the activity.

## Parameters

### workers

readonly [`Worker`](../../index/interfaces/Worker.md)\[]

### queue

`string`

### activity

`string`

## Returns

[`Worker`](../../index/interfaces/Worker.md) | `undefined`
