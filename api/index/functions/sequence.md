---
url: /vlo/api/index/functions/sequence.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / sequence

# Function: sequence()

> **sequence**(`steps`, `options?`): [`WorkflowDef`](../interfaces/WorkflowDef.md)<[`SeqState`](../interfaces/SeqState.md), [`Json`](../type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/core/helpers/sequence.ts:254](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence.ts#L254)

Compiles an ordered list of phases into a [WorkflowDef](../interfaces/WorkflowDef.md) for [defineWorkflow](defineWorkflow.md).

Phases run one after another: [step](step.md), [fanOut](fanOut.md), [fanOutRuns](fanOutRuns.md),
[waitFor](waitFor.md) and [sleep](sleep.md). Outputs go to `results` keyed by activity or workflow
name and signal payloads to `signals` keyed by signal name, so two phases on the same
target share a key. After the last phase the run completes with `results`, or with
`options.output(state)`. `state.usage` always holds the run's banked usage as of the
last event. Events that do not belong to the current phase are ignored: state
unchanged, no commands.

## Parameters

### steps

readonly [`SeqStep`](../type-aliases/SeqStep.md)\[]

### options?

[`SequenceOptions`](../interfaces/SequenceOptions.md) = `{}`

## Returns

[`WorkflowDef`](../interfaces/WorkflowDef.md)<[`SeqState`](../interfaces/SeqState.md), [`Json`](../type-aliases/Json.md)>

## Example

```ts
import {
  defineWorkflow, fanOut, fanOutResultsOf, resultOf, sequence, signalOf, step, waitFor,
} from "@oona/vlo";
import { approve, finish, plan, work } from "./activities.ts";

export default defineWorkflow("example", sequence([
  step(plan),
  fanOut(work, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2 }),
  waitFor(approve),
  step(finish, (s) => ({
    uppers: fanOutResultsOf(s, work).map((o) => o.upper),
    approvedBy: signalOf(s, approve).by,
  })),
], { output: (s) => ({ report: resultOf(s, finish).report, tokens: s.usage?.tokens ?? 0 }) }));
```
