---
url: /vlo/api/host/interfaces/ServeOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ServeOptions

# Interface: ServeOptions

Defined in: [sdk/ts/sdk/src/host/roles.ts:273](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L273)

[CreateHostOptions](CreateHostOptions.md) plus where to listen.

## Extends

* [`CreateHostOptions`](CreateHostOptions.md)

## Properties

### activities?

> `optional` **activities?**: readonly [`ActivityRegistration`](ActivityRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L61)

Activities whose output schema the host enforces before folding a result. Unregistered
activities still run; their output is folded as opaque JSON.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`activities`](CreateHostOptions.md#activities)

***

### auth?

> `optional` **auth?**: [`AuthConfig`](AuthConfig.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L71)

Credentials for the control plane, inbound pushes, callbacks and signed links. Absent ⇒ open host.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`auth`](CreateHostOptions.md#auth)

***

### basePath?

> `optional` **basePath?**: `string`

Defined in: [sdk/ts/sdk/src/host/roles.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L81)

Path prefix this host is mounted under, e.g. `"/api/vlo"` for a Next route file at
`app/api/vlo/[[...path]]/route.ts`. The router strips it before matching and every URL
built from `publicUrl` carries it.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`basePath`](CreateHostOptions.md#basepath)

***

### blob?

> `optional` **blob?**: `string` | [`BlobStore`](BlobStore.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L52)

A `BlobStore`, or a `file://` / `gcs://` URL to open. Default [DEFAULT_BLOB_URL](../variables/DEFAULT_BLOB_URL.md).

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`blob`](CreateHostOptions.md#blob)

***

### dispatcher?

> `optional` **dispatcher?**: [`DispatcherOptions`](DispatcherOptions.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L89)

Outbox dispatcher tuning. Only read when this host holds the `orchestrator` role.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`dispatcher`](CreateHostOptions.md#dispatcher)

***

### domains?

> `optional` **domains?**: readonly [`Domain`](../../index/interfaces/Domain.md)\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L56)

Domains from `defineDomain`; their registries are flattened onto the four arrays below.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`domains`](CreateHostOptions.md#domains)

***

### hostname?

> `optional` **hostname?**: `string`

Defined in: [sdk/ts/sdk/src/host/roles.ts:277](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L277)

Interface to bind. Default `127.0.0.1`.

***

### journal

> **journal**: `string` | [`Journal`](Journal.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:50](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L50)

A `Journal`, or a URL the host opens (and closes on `stop`).

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`journal`](CreateHostOptions.md#journal)

***

### kernel?

> `optional` **kernel?**: [`Kernel`](Kernel.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L87)

Injected for tests; otherwise the wasm kernel is loaded on `start`.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`kernel`](CreateHostOptions.md#kernel)

***

### namespace?

> `optional` **namespace?**: `string`

Defined in: [sdk/ts/sdk/src/host/roles.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L73)

Namespace new runs are created in and `listRuns` filters by. Default `"default"`.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`namespace`](CreateHostOptions.md#namespace)

***

### now?

> `optional` **now?**: () => `number`

Defined in: [sdk/ts/sdk/src/host/roles.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L85)

Clock for every journaled timestamp, in epoch milliseconds. Default `Date.now`.

#### Returns

`number`

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`now`](CreateHostOptions.md#now)

***

### port?

> `optional` **port?**: `number`

Defined in: [sdk/ts/sdk/src/host/roles.ts:275](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L275)

TCP port to bind. Default [DEFAULT_PORT](../variables/DEFAULT_PORT.md); `0` picks a free one.

***

### publicUrl?

> `optional` **publicUrl?**: `string`

Defined in: [sdk/ts/sdk/src/host/roles.ts:75](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L75)

Base URL peers reach this host on; fills `complete_url` on an outbound push.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`publicUrl`](CreateHostOptions.md#publicurl)

***

### queues?

> `optional` **queues?**: `Record`<`string`, [`QueueConfig`](QueueConfig.md)>

Defined in: [sdk/ts/sdk/src/host/roles.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L69)

Per-queue delivery: a push URL and secret, or `mode: "pull"`. Queues not listed are in-process only.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`queues`](CreateHostOptions.md#queues)

***

### roles?

> `optional` **roles?**: readonly [`Role`](../type-aliases/Role.md)\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L67)

Roles this process holds. Default: `orchestrator`, `api`, plus one `worker:<queue>` per queue of every worker.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`roles`](CreateHostOptions.md#roles)

***

### signals?

> `optional` **signals?**: readonly [`SignalRegistration`](SignalRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L65)

Signals whose payload the host validates before delivery. Unregistered signals pass through as-is.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`signals`](CreateHostOptions.md#signals)

***

### streamPollMs?

> `optional` **streamPollMs?**: `number`

Defined in: [sdk/ts/sdk/src/host/roles.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L83)

How often an open SSE stream looks for new journal events. Default 500 ms.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`streamPollMs`](CreateHostOptions.md#streampollms)

***

### workers?

> `optional` **workers?**: readonly [`Worker`](../../index/interfaces/Worker.md)\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L63)

Workers run in this process. Each adds a `worker:<queue>` role when `roles` is absent.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`workers`](CreateHostOptions.md#workers)

***

### workflows?

> `optional` **workflows?**: readonly [`Workflow`](../../index/interfaces/Workflow.md)<`unknown`, `unknown`>\[]

Defined in: [sdk/ts/sdk/src/host/roles.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L54)

Workflows this host can run, by name. Starting an unregistered one is refused. Optional when `domains` supplies them.

#### Inherited from

[`CreateHostOptions`](CreateHostOptions.md).[`workflows`](CreateHostOptions.md#workflows)
