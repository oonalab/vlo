---
url: /vlo/api/host/classes/HttpPushTransport.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / HttpPushTransport

# Class: HttpPushTransport

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L37)

Pushes tasks to a remote worker over signed HTTP. Built by the dispatcher per configured queue.

## Implements

* [`TaskTransport`](../interfaces/TaskTransport.md)

## Constructors

### Constructor

> **new HttpPushTransport**(`options`): `HttpPushTransport`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L47)

Throws a plain `Error` when `secret` is empty: tasks are never pushed unsigned.

#### Parameters

##### options

[`HttpPushOptions`](../interfaces/HttpPushOptions.md)

#### Returns

`HttpPushTransport`

## Properties

### kind

> `readonly` **kind**: `"http-push"` = `"http-push"`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L39)

Always `http-push`.

#### Implementation of

[`TaskTransport`](../interfaces/TaskTransport.md).[`kind`](../interfaces/TaskTransport.md#kind)

## Methods

### push()

> **push**(`task`): `Promise`<[`PushResult`](../type-aliases/PushResult.md)>

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L62)

POSTs the task with the four `vlo-*` headers. Never throws: a network error, a timeout
or a 5xx is `accepted: false` without `fatal`; a non-retryable 4xx sets `fatal`.

#### Parameters

##### task

[`PushedTask`](../interfaces/PushedTask.md)

#### Returns

`Promise`<[`PushResult`](../type-aliases/PushResult.md)>

#### Implementation of

[`TaskTransport`](../interfaces/TaskTransport.md).[`push`](../interfaces/TaskTransport.md#push)
