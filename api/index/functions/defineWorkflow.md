---
url: /vlo/api/index/functions/defineWorkflow.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / defineWorkflow

# Function: defineWorkflow()

> **defineWorkflow**<`S`, `I`>(`name`, `def`): [`Workflow`](../interfaces/Workflow.md)<`S`, `I`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:112](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L112)

Defines a workflow: a named, pure reducer over the run's events.

`def` is either a hand-written [WorkflowDef](../interfaces/WorkflowDef.md) or the output of [sequence](sequence.md).
Handlers must not read a clock, generate randomness or do I/O; time and randomness arrive
on the event. State must be JSON-serialisable: it is stringified after every reduction.
A handler that throws fails the run (see [WorkflowFailure](../classes/WorkflowFailure.md)); so does an event
whose handler is not registered, or a handler returning anything but `[state, Command[]]`.

## Type Parameters

### S

`S`

### I

`I`

## Parameters

### name

`string`

### def

[`WorkflowDef`](../interfaces/WorkflowDef.md)<`S`, `I`>

## Returns

[`Workflow`](../interfaces/Workflow.md)<`S`, `I`>

## Example

```ts
import { cmd, defineWorkflow } from "@oona/vlo";
import { work } from "./activities.ts";

export default defineWorkflow("uppercase", {
  init: (input: { item: string }) => ({ item: input.item }),
  on: {
    started: (s) => [s, [cmd.task(work, { item: s.item })]],
    task_done: (s, e) => [s, [cmd.complete(e.output ?? null)]],
  },
});
```
