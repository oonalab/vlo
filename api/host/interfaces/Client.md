---
url: /vlo/api/host/interfaces/Client.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Client

# Interface: Client

Defined in: [sdk/ts/sdk/src/client/index.ts:101](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L101)

The control-plane client. Every method maps to one `/v1` route and throws a plain `Error`
carrying the status and body on a non-2xx answer. Names may be passed as the definition
objects themselves (`activity(...)`, `signal(...)`, `defineWorkflow(...)`).

## Methods

### cancel()

> **cancel**(`runId`): `Promise`<[`RunView`](RunView.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:132](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L132)

Cancels the run and returns its view.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`RunView`](RunView.md)>

***

### events()

> **events**(`runId`, `since?`): `Promise`<[`Envelope`](Envelope.md)\[]>

Defined in: [sdk/ts/sdk/src/client/index.ts:128](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L128)

Journaled events with `seq > since` (default 0).

#### Parameters

##### runId

`string`

##### since?

`number`

#### Returns

`Promise`<[`Envelope`](Envelope.md)\[]>

***

### find()

> **find**(`runId`): `Promise`<[`RunView`](RunView.md) | `null`>

Defined in: [sdk/ts/sdk/src/client/index.ts:126](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L126)

The run's current view, or `null` when the host has no such run.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`RunView`](RunView.md) | `null`>

***

### get()

> **get**(`runId`): `Promise`<[`RunView`](RunView.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:124](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L124)

The run's current view.

#### Parameters

##### runId

`string`

#### Returns

`Promise`<[`RunView`](RunView.md)>

***

### list()

> **list**(`query?`): `Promise`<[`RunView`](RunView.md)\[]>

Defined in: [sdk/ts/sdk/src/client/index.ts:134](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L134)

Runs in the host's namespace matching the query.

#### Parameters

##### query?

[`ListQuery`](ListQuery.md)

#### Returns

`Promise`<[`RunView`](RunView.md)\[]>

***

### signal()

> **signal**(`runId`, `name`, `payload`): `Promise`<[`SignalResult`](SignalResult.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:105](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L105)

Sends a signal; buffered when the run is not waiting for it yet.

#### Parameters

##### runId

`string`

##### name

`string` | { `name`: `string`; }

##### payload

[`Json`](../../index/type-aliases/Json.md)

#### Returns

`Promise`<[`SignalResult`](SignalResult.md)>

***

### signalLink()

> **signalLink**(`runId`, `name`, `options?`): `Promise`<[`SignalLink`](SignalLink.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:111](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L111)

Mints a URL that delivers this one signal to this one run without a bearer token —
the thing you put in an email. The host signs it; opening it renders a confirmation
form, and submitting that form is what signals the run.

#### Parameters

##### runId

`string`

##### name

`string` | { `name`: `string`; }

##### options?

[`SignalLinkOptions`](SignalLinkOptions.md)

#### Returns

`Promise`<[`SignalLink`](SignalLink.md)>

***

### start()

> **start**(`workflow`, `input`, `options?`): `Promise`<[`RunView`](RunView.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:103](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L103)

Starts a run and returns its view once the row exists (status `created` or later).

#### Parameters

##### workflow

`string` | { `name`: `string`; }

##### input

[`Json`](../../index/type-aliases/Json.md)

##### options?

[`StartOptions`](StartOptions.md)

#### Returns

`Promise`<[`RunView`](RunView.md)>

***

### startFresh()

> **startFresh**(`workflow`, `input`, `options`): `Promise`<[`StartFreshResult`](StartFreshResult.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:122](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L122)

Starts a run under `runId`, or under `${runId}_2`, `_3`, … once earlier runs with the
key have ended: the first id with no run is started, a live one is joined. The walk is
deterministic, so two concurrent callers land on the same id and the insert's
`ON CONFLICT DO NOTHING` makes one of them the joiner.

#### Parameters

##### workflow

`string` | { `name`: `string`; }

##### input

[`Json`](../../index/type-aliases/Json.md)

##### options

[`StartFreshOptions`](StartFreshOptions.md)

#### Returns

`Promise`<[`StartFreshResult`](StartFreshResult.md)>

***

### stream()

> **stream**(`runId`, `options?`): `AsyncIterable`<[`StreamMessage`](../type-aliases/StreamMessage.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:130](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L130)

Live events over SSE: journal envelopes, `cmd.emit` payloads, then one `end`.

#### Parameters

##### runId

`string`

##### options?

[`StreamOptions`](StreamOptions.md)

#### Returns

`AsyncIterable`<[`StreamMessage`](../type-aliases/StreamMessage.md)>

***

### waitFor()

> **waitFor**(`runId`, `status`, `timeoutMs?`): `Promise`<[`RunView`](RunView.md)>

Defined in: [sdk/ts/sdk/src/client/index.ts:136](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L136)

Polls every 50 ms until the run reaches one of `status`. Throws after `timeoutMs` (default 10 s).

#### Parameters

##### runId

`string`

##### status

[`RunStatus`](../../index/type-aliases/RunStatus.md) | readonly [`RunStatus`](../../index/type-aliases/RunStatus.md)\[]

##### timeoutMs?

`number`

#### Returns

`Promise`<[`RunView`](RunView.md)>
