---
url: /vlo/api/host/interfaces/SignalRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalRow

# Interface: SignalRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:167](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L167)

One row of `signals`: a delivered or buffered signal.

## Properties

### created_at_ms

> **created_at_ms**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:181](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L181)

Row creation, epoch milliseconds.

***

### delivered_at_ms?

> `optional` **delivered_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:183](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L183)

When it was folded into the run, epoch milliseconds; absent while buffered.

***

### delivered_step_id?

> `optional` **delivered_step_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:185](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L185)

The step it was delivered to.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:173](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L173)

Signal name.

***

### payload?

> `optional` **payload?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:175](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L175)

Inline payload, byte-exact JSON.

***

### payload_ref?

> `optional` **payload_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:177](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L177)

Blob reference for an offloaded payload.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:171](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L171)

The run it was sent to.

***

### sender?

> `optional` **sender?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:179](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L179)

Free-form sender. Unused by the host.

***

### signal_id

> **signal_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:169](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L169)

Primary key.
