---
url: /vlo/api/index/functions/waitFor.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / waitFor

# Function: waitFor()

> **waitFor**<`T`>(`definition`, `options?`): [`SeqStep`](../type-aliases/SeqStep.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:194](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L194)

A [sequence](sequence.md) phase that parks the run until `definition` is delivered.

The payload is stored in `signals[definition.name]`. With `timeoutMs` the wait races the
kernel's paired deadline timer (the loser is cancelled): `onTimeout: "fail"` (default)
fails the run, `"continue"` stores `null` and advances. `context` is emitted on the
`human` channel when the wait opens. A signal or deadline arriving for a phase already
left behind is ignored.

## Type Parameters

### T

`T`

## Parameters

### definition

[`SignalDef`](../interfaces/SignalDef.md)<`T`>

### options?

[`WaitForOptions`](../interfaces/WaitForOptions.md) = `{}`

## Returns

[`SeqStep`](../type-aliases/SeqStep.md)

## Example

```ts
import { defineWorkflow, sequence, signalOf, step, waitFor } from "@oona/vlo";
import { approve, finish, plan } from "./activities.ts";

export default defineWorkflow("example", sequence([
  step(plan),
  waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail", context: { what: "plan" } }),
  step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by })),
]));
```
