---
url: /vlo/api/index/interfaces/SeqState.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / SeqState

# Interface: SeqState

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L24)

State of a workflow built by [sequence](../functions/sequence.md). `mapInput`, `select`, `when` and `output`
callbacks read it; the run completes with `results` (or `output(state)`) as its output.

## Properties

### fan?

> `optional` **fan?**: [`FanState`](FanState.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L34)

Present only while a [fanOut](../functions/fanOut.md) or [fanOutRuns](../functions/fanOutRuns.md) phase is in flight.

***

### input

> **input**: [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L28)

The run's start input.

***

### phase

> **phase**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L26)

Index of the phase currently in flight.

***

### results

> **results**: `Record`<`string`, [`Json`](../type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L30)

Outputs of finished [step](../functions/step.md), [fanOut](../functions/fanOut.md) and [fanOutRuns](../functions/fanOutRuns.md) phases, keyed by activity or workflow name.

***

### signals

> **signals**: `Record`<`string`, [`Json`](../type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L32)

Payloads of finished [waitFor](../functions/waitFor.md) phases, keyed by signal name; `null` after a `"continue"` timeout.

***

### usage?

> `optional` **usage?**: [`Usage`](Usage.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L39)

The run's banked usage as of the last folded event (`event.usage_total`). Absent on a
checkpoint written before any event was folded with this field.
