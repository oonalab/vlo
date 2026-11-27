---
url: /vlo/api/index/interfaces/QueueProfile.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / QueueProfile

# Interface: QueueProfile

Defined in: [sdk/ts/sdk/src/config/define.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L56)

How tasks on one queue reach their workers. A queue with neither `url` nor `mode` is
served only by a worker in the same process.

## Properties

### mode?

> `optional` **mode?**: `"push"` | `"pull"`

Defined in: [sdk/ts/sdk/src/config/define.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L62)

`"push"` delivers to `url`; `"pull"` never pushes and lets workers long-poll the host instead.

***

### secret?

> `optional` **secret?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L60)

HMAC secret shared with the worker behind `url`; required for an HTTP push.

***

### url?

> `optional` **url?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L58)

Endpoint the dispatcher pushes tasks to, payload included.
