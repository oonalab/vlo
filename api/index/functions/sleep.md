---
url: /vlo/api/index/functions/sleep.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / sleep

# Function: sleep()

> **sleep**(`ms`): [`SeqStep`](../type-aliases/SeqStep.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:221](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L221)

A [sequence](sequence.md) phase that parks the run on a timer for `ms` milliseconds. It stores
nothing: the phase after it receives the value of the last phase that stored one.

## Parameters

### ms

`number`

## Returns

[`SeqStep`](../type-aliases/SeqStep.md)

## Example

```ts
import { defineWorkflow, sequence, sleep, step } from "@oona/vlo";
import { plan, finish } from "./activities.ts";

export default defineWorkflow("example", sequence([
  step(plan),
  sleep(60_000),
  step(finish, (state) => ({ uppers: [], approvedBy: "timer" })),
]));
```
