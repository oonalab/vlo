---
url: /vlo/api/host/interfaces/Listening.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Listening

# Interface: Listening

Defined in: [sdk/ts/sdk/src/host/node-server.ts:16](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L16)

A bound `node:http` server.

## Extended by

* [`ServeResult`](ServeResult.md)

## Properties

### port

> **port**: `number`

Defined in: [sdk/ts/sdk/src/host/node-server.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L20)

The port actually bound; differs from the request when `0` was asked for.

***

### url

> **url**: `string`

Defined in: [sdk/ts/sdk/src/host/node-server.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L18)

`http://<host>:<port>`, with the port actually bound.

## Methods

### close()

> **close**(): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/node-server.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L22)

Closes every open connection (SSE streams included) and stops listening.

#### Returns

`Promise`<`void`>
