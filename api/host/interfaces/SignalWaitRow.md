---
url: /vlo/api/host/interfaces/SignalWaitRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalWaitRow

# Interface: SignalWaitRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:153](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L153)

One row of `signal_waits`: a step parked on a named signal.

## Properties

### expires_at_ms?

> `optional` **expires_at_ms?**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:163](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L163)

Wait deadline, epoch milliseconds.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:159](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L159)

Signal name waited for.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:155](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L155)

The waiting run.

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:161](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L161)

Registered schema version of the signal.

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:157](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L157)

The waiting step.
