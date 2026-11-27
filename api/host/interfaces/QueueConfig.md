---
url: /vlo/api/host/interfaces/QueueConfig.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / QueueConfig

# Interface: QueueConfig

Defined in: [sdk/ts/sdk/src/host/context.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L65)

How tasks on one queue leave this host.

## Properties

### mode?

> `optional` **mode?**: `"push"` | `"pull"`

Defined in: [sdk/ts/sdk/src/host/context.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L71)

`push` (default) dispatches from the outbox; `pull` leaves tasks for `POST /v1/tasks/poll`.

***

### secret?

> `optional` **secret?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L69)

HMAC secret shared with the queue's worker. Required for HTTP push.

***

### url?

> `optional` **url?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L67)

Where to push tasks on this queue. Absent ⇒ in-process only.
