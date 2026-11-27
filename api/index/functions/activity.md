---
url: /vlo/api/index/functions/activity.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / activity

# Function: activity()

> **activity**<`I`, `O`>(`name`, `options`): [`Activity`](../interfaces/Activity.md)<`output`<`I`>, `output`<`O`>>

Defined in: [sdk/ts/sdk/src/core/activity.ts:160](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L160)

Defines an activity: a named unit of work a worker implements and a reducer requests
with `cmd.task`.

The content hash covers `name`, both schemas (as JSON Schema, projected by
[projectSchema](projectSchema.md) so annotations such as `description` and `default` are
hash-neutral) and the resolved retry policy, so changing any of them yields a new
`schemaRef`; `queue`, `leaseMs` and `timeoutMs` are operational and hash-neutral. Runs
pin the `schemaRef` per event, so old and new versions coexist.

## Type Parameters

### I

`I` *extends* `ZodType`<`unknown`, `unknown`, `$ZodTypeInternals`<`unknown`, `unknown`>>

### O

`O` *extends* `ZodType`<`unknown`, `unknown`, `$ZodTypeInternals`<`unknown`, `unknown`>>

## Parameters

### name

`string`

### options

[`ActivityOptions`](../interfaces/ActivityOptions.md)<`I`, `O`>

## Returns

[`Activity`](../interfaces/Activity.md)<`output`<`I`>, `output`<`O`>>

## Example

```ts
import { z } from "zod";
import { activity } from "@oona/vlo";

export const work = activity("example.work", {
  input: z.object({ item: z.string() }),
  output: z.object({ upper: z.string() }),
  retry: { maxAttempts: 3 },
  queue: "default",
  timeoutMs: 30_000,
});
```
