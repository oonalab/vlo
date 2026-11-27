---
url: /vlo/api/host/interfaces/ClientOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ClientOptions

# Interface: ClientOptions

Defined in: [sdk/ts/sdk/src/client/index.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L15)

How to reach a host.

## Properties

### baseUrl?

> `optional` **baseUrl?**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L17)

Absent when `fetch` is a host handler: requests still need a syntactically valid URL.

***

### fetch?

> `optional` **fetch?**: [`ClientFetch`](../type-aliases/ClientFetch.md)

Defined in: [sdk/ts/sdk/src/client/index.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L21)

Transport. Default `globalThis.fetch`; pass `host.fetch` to skip the socket.

***

### token?

> `optional` **token?**: `string`

Defined in: [sdk/ts/sdk/src/client/index.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L19)

Bearer token for the control plane, when the host has one.
