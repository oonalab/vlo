---
url: /vlo/api/host/interfaces/SignalWait.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalWait

# Interface: SignalWait

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L93)

A signal wait row to insert: the run is parked until a signal with this name arrives.

## Properties

### expires_at_ms?

> `optional` **expires_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:101](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L101)

Deadline in milliseconds since the epoch; absent means wait forever.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L97)

Signal name.

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:99](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L99)

Schema reference for payload validation, when the signal declares one.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L95)

Step id inside the run.
