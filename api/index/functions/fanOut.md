---
url: /vlo/api/index/functions/fanOut.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / fanOut

# Function: fanOut()

> **fanOut**<`I`, `O`>(`target`, `select`, `options`): [`SeqStep`](../type-aliases/SeqStep.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:113](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L113)

A [sequence](sequence.md) phase that runs `target` once per item `select` returns, at most
`concurrency` at a time, with step ids `${target.name}#${index}`.

`select` must be pure and read only state written by earlier phases: it is re-evaluated
on every event of the phase and the run fails if it returns a different count. Outputs
are stored in `results[target.name]` in item order; an empty selection stores `[]` and
moves on. A task that does not succeed fails the run, unless `onFailure: "continue"`
stores `null` for that item.

Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### target

[`Activity`](../interfaces/Activity.md)<`I`, `O`>

### select

(`state`) => `I`\[]

### options

[`FanOutOptions`](../interfaces/FanOutOptions.md)

## Returns

[`SeqStep`](../type-aliases/SeqStep.md)

## Example

```ts
import { defineWorkflow, fanOut, resultOf, sequence, step } from "@oona/vlo";
import { plan, work } from "./activities.ts";

export default defineWorkflow("example", sequence([
  step(plan),
  fanOut(work, (state) => resultOf(state, plan).items.map((item) => ({ item })), { concurrency: 2 }),
]));
```
