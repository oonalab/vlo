---
url: /vlo/api/host/interfaces/TimerRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TimerRow

# Interface: TimerRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:139](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L139)

One row of `timers`. Keyed by `(run_id, step_id)`.

## Properties

### claimed_until_ms?

> `optional` **claimed_until_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:149](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L149)

Outbox claim held by the fire-timers stage, epoch milliseconds.

***

### fire_at_ms

> **fire_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:145](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L145)

When it is due, epoch milliseconds.

***

### fired_at_ms?

> `optional` **fired_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:147](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L147)

When it fired, epoch milliseconds; set exactly once.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:141](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L141)

The run that set it.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:143](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L143)

The workflow step.
