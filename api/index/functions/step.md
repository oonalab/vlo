---
url: /vlo/api/index/functions/step.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / step

# Function: step()

> **step**<`I`, `O`>(`target`, `mapInput?`, `options?`): [`SeqStep`](../type-aliases/SeqStep.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:72](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L72)

A [sequence](sequence.md) phase that runs `target` once.

Without `mapInput` the task input is the run's start input for phase 0 and the previous
phase's stored value afterwards (sleeps are skipped). The output is stored in
`results[target.name]`. A task that does not succeed fails the run, unless
`onFailure: "continue"` stores `null` instead; `when` returning `false` also stores `null`
and skips the task. `id` pins the step id for handlers that key on it.

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### target

[`Activity`](../interfaces/Activity.md)<`I`, `O`>

### mapInput?

(`state`) => `I`

### options?

[`StepOptions`](../interfaces/StepOptions.md) = `{}`

## Returns

[`SeqStep`](../type-aliases/SeqStep.md)

## Example

```ts
import { defineWorkflow, resultOf, sequence, step } from "@oona/vlo";
import { finish, notify, plan } from "./activities.ts";

export default defineWorkflow("example", sequence([
  step(plan),
  step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" })),
  step(notify, undefined, { onFailure: "continue", when: (s) => resultOf(s, plan).items.length > 0 }),
]));
```
