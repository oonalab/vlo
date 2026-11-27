---
url: /vlo/api/host/interfaces/ServeResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ServeResult

# Interface: ServeResult

Defined in: [sdk/ts/sdk/src/host/roles.ts:281](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L281)

A bound server: the listener's `url`, `port` and `close()`, plus the host behind it.

## Extends

* [`Listening`](Listening.md)

## Properties

### host

> **host**: [`Host`](Host.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:283](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L283)

The host serving requests. `close()` on the result stops it too.

***

### port

> **port**: `number`

Defined in: [sdk/ts/sdk/src/host/node-server.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L20)

The port actually bound; differs from the request when `0` was asked for.

#### Inherited from

[`Listening`](Listening.md).[`port`](Listening.md#port)

***

### url

> **url**: `string`

Defined in: [sdk/ts/sdk/src/host/node-server.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L18)

`http://<host>:<port>`, with the port actually bound.

#### Inherited from

[`Listening`](Listening.md).[`url`](Listening.md#url)

## Methods

### close()

> **close**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/node-server.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L22)

Closes every open connection (SSE streams included) and stops listening.

#### Returns

`Promise`<`void`>

#### Inherited from

[`Listening`](Listening.md).[`close`](Listening.md#close)
