---
url: /vlo/api/index/interfaces/Profile.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Profile

# Interface: Profile

Defined in: [sdk/ts/sdk/src/config/define.ts:103](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L103)

One environment's wiring: where state lives, how queues deliver, which roles run.

## Properties

### auth?

> `optional` **auth?**: `object`

Defined in: [sdk/ts/sdk/src/config/define.ts:115](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L115)

`token`: bearer for the control-plane routes. `pushSecret`: HMAC secret inbound pushes are verified with.

#### pushSecret?

> `optional` **pushSecret?**: [`Ref`](../type-aliases/Ref.md)

#### token?

> `optional` **token?**: [`Ref`](../type-aliases/Ref.md)

***

### blob?

> `optional` **blob?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:111](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L111)

Blob store URL for payloads over the inline limit: `file://<dir>` or `gcs://<bucket>/<prefix>`. Default `file://.vlo/blobs`.

***

### deploy?

> `optional` **deploy?**: [`DeployProfile`](DeployProfile.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:123](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L123)

Template inputs for `vlo deploy`; see [DeployProfile](DeployProfile.md).

***

### dispatcher?

> `optional` **dispatcher?**: [`DispatcherProfile`](DispatcherProfile.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:121](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L121)

Outbox dispatcher settings; see [DispatcherProfile](DispatcherProfile.md).

***

### ~~host?~~

> `optional` **host?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:105](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L105)

#### Deprecated

Use `publicUrl`. Kept so existing configs keep loading.

***

### journal

> **journal**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:109](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L109)

Journal URL: `sqlite://<path>` or a Postgres connection string. Required.

***

### port?

> `optional` **port?**: `number`

Defined in: [sdk/ts/sdk/src/config/define.ts:117](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L117)

Port `vlo serve` listens on. `--port` and `PORT` take precedence.

***

### publicUrl?

> `optional` **publicUrl?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:107](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L107)

Base URL peers reach this host on. Fills `complete_url` on an outbound push.

***

### queues?

> `optional` **queues?**: `Record`<`string`, [`QueueProfile`](QueueProfile.md)>

Defined in: [sdk/ts/sdk/src/config/define.ts:113](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L113)

Delivery settings per queue name; see [QueueProfile](QueueProfile.md).

***

### roles?

> `optional` **roles?**: readonly [`Role`](../../host/type-aliases/Role.md)\[]

Defined in: [sdk/ts/sdk/src/config/define.ts:119](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L119)

Roles this process runs. Absent ⇒ orchestrator + api + every in-process worker.
