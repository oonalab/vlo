---
url: /vlo/api/host/classes/InProcessTransport.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / InProcessTransport

# Class: InProcessTransport

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:66](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L66)

Runs tasks on a worker in this process. Built by the dispatcher for each `worker:<queue>` role.

## Implements

* [`TaskTransport`](../interfaces/TaskTransport.md)

## Constructors

### Constructor

> **new InProcessTransport**(`worker`, `reporter`, `options?`): `InProcessTransport`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L71)

`reporter` is where the handler's result goes; usually `localReporter(ctx)`.

#### Parameters

##### worker

[`Worker`](../../index/interfaces/Worker.md)

##### reporter

[`TaskReporter`](../interfaces/TaskReporter.md)

##### options?

[`InProcessOptions`](../interfaces/InProcessOptions.md) = `{}`

#### Returns

`InProcessTransport`

## Properties

### kind

> `readonly` **kind**: `"in-process"` = `"in-process"`

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:68](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L68)

Always `in-process`.

#### Implementation of

[`TaskTransport`](../interfaces/TaskTransport.md).[`kind`](../interfaces/TaskTransport.md#kind)

## Methods

### push()

> **push**(`task`): `Promise`<[`PushResult`](../type-aliases/PushResult.md)>

Defined in: [sdk/ts/sdk/src/host/transport/in-process.ts:78](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/in-process.ts#L78)

Always accepts. The handler starts on the next macrotask, after the dispatcher has committed `running`.

#### Parameters

##### task

[`PushedTask`](../interfaces/PushedTask.md)

#### Returns

`Promise`<[`PushResult`](../type-aliases/PushResult.md)>

#### Implementation of

[`TaskTransport`](../interfaces/TaskTransport.md).[`push`](../interfaces/TaskTransport.md#push)
