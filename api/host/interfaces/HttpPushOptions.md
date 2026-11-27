---
url: /vlo/api/host/interfaces/HttpPushOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / HttpPushOptions

# Interface: HttpPushOptions

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L23)

Where and how to push one queue's tasks.

## Properties

### fetch?

> `optional` **fetch?**: [`FetchLike`](../type-aliases/FetchLike.md)

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:31](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L31)

`fetch` implementation. Default `globalThis.fetch`.

***

### now?

> `optional` **now?**: () => `number`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L29)

Clock for the signed timestamp, epoch milliseconds. Default `Date.now`.

#### Returns

`number`

***

### secret

> **secret**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L27)

HMAC secret shared with the worker. Required: an empty secret is refused.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L33)

Per-push request timeout in milliseconds. Default 5 s.

***

### url

> **url**: `string`

Defined in: [sdk/ts/sdk/src/host/transport/http-push.ts:25](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/http-push.ts#L25)

The worker's push endpoint, typically `<worker base>/v1/tasks/push`.
