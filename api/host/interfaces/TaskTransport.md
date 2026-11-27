---
url: /vlo/api/host/interfaces/TaskTransport.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskTransport

# Interface: TaskTransport

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L41)

Delivers a scheduled task to whatever runs it. The dispatcher picks one per queue.

## Properties

### kind

> `readonly` **kind**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L43)

A label for warnings, e.g. `http-push` or `in-process`.

## Methods

### push()

> **push**(`task`): `Promise`<[`PushResult`](../type-aliases/PushResult.md)>

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L45)

Hands the task over. Must not throw for a refused push; report it in the result.

#### Parameters

##### task

[`PushedTask`](PushedTask.md)

#### Returns

`Promise`<[`PushResult`](../type-aliases/PushResult.md)>
