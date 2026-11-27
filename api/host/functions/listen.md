---
url: /vlo/api/host/functions/listen.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / listen

# Function: listen()

> **listen**(`handler`, `port`, `host?`): `Promise`<[`Listening`](../interfaces/Listening.md)>

Defined in: [sdk/ts/sdk/src/host/node-server.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/node-server.ts#L30)

Serves a fetch-style handler on `port` (`0` picks a free one) and `host` (default
`127.0.0.1`). Rejects when the port cannot be bound. Response bodies are streamed, so an
SSE response works without a framework.

## Parameters

### handler

[`FetchHandler`](../type-aliases/FetchHandler.md)

### port

`number`

### host?

`string` = `"127.0.0.1"`

## Returns

`Promise`<[`Listening`](../interfaces/Listening.md)>
