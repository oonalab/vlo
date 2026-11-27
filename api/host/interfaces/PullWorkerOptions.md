---
url: /vlo/api/host/interfaces/PullWorkerOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PullWorkerOptions

# Interface: PullWorkerOptions

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L23)

## Properties

### baseUrl

> **baseUrl**: `string`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:25](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L25)

The host's base URL, e.g. `https://vlo.example.com`.

***

### concurrency?

> `optional` **concurrency?**: `number`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L35)

Tasks run at once. Default 4; at most 10 are requested per poll.

***

### fetch?

> `optional` **fetch?**: [`FetchLike`](../type-aliases/FetchLike.md)

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L41)

`fetch` implementation. Default `globalThis.fetch`.

***

### onError?

> `optional` **onError?**: (`error`) => `void`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L43)

Called for a poll that failed; the loop backs off and carries on.

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### queues?

> `optional` **queues?**: readonly `string`\[]

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:31](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L31)

Queues to poll, round-robin. Defaults to the queues the worker declares.

***

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L37)

Stops polling when aborted; in-flight handlers see it on `ctx.signal`.

***

### token?

> `optional` **token?**: `string`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L27)

Control-plane bearer token; also sent when reporting results.

***

### waitMs?

> `optional` **waitMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L33)

How long the host may hold a poll open with no work. Capped at 25 s by the host.

***

### worker

> **worker**: [`Worker`](../../index/interfaces/Worker.md)

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L29)

The activity implementations to run.

***

### workerId?

> `optional` **workerId?**: `string`

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L39)

Sent as `worker_id` and recorded on the task. Default `vlo-pull-<8 hex>`.
