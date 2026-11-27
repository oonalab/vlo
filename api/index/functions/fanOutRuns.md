---
url: /vlo/api/index/functions/fanOutRuns.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / fanOutRuns

# Function: fanOutRuns()

> **fanOutRuns**<`I`>(`target`, `select`, `options`): [`SeqStep`](../type-aliases/SeqStep.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:157](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L157)

A [sequence](sequence.md) phase that spawns one child run of `target` per item `select` returns,
at most `concurrency` at a time, with step ids `${workflow}#${index}`.

`select` has the same purity rule as [fanOut](fanOut.md). Each item is the child's start input.
The phase stores a [ChildResult](../interfaces/ChildResult.md) per item in `results[workflow]`, in item order;
read it with [fanOutRunsResultsOf](fanOutRunsResultsOf.md). An empty selection stores `[]` and moves on.
A child that did not complete fails the run, unless `onFailure: "continue"` records its
status and moves on. The child workflow must be registered on the same host.

Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.

## Type Parameters

### I

`I` *extends* [`Json`](../type-aliases/Json.md) = [`Json`](../type-aliases/Json.md)

## Parameters

### target

`string` | { `name`: `string`; }

### select

(`state`) => `I`\[]

### options

[`FanOutRunsOptions`](../interfaces/FanOutRunsOptions.md)

## Returns

[`SeqStep`](../type-aliases/SeqStep.md)

## Example

```ts
import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, resultOf, sequence, step } from "@oona/vlo";
import { plan, summarise } from "./activities.ts";
import { readSource } from "./read-source.workflow.ts";

export default defineWorkflow("research", sequence([
  step(plan),
  fanOutRuns(readSource, (s) => resultOf(s, plan).sourceIds.map((sourceId) => ({ sourceId })), {
    concurrency: 5,
    onFailure: "continue",
  }),
  step(summarise, (s) => ({ read: fanOutRunsResultsOf(s, readSource).filter((r) => r.status === "succeeded").length })),
]));
```
