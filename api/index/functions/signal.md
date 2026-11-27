---
url: /vlo/api/index/functions/signal.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / signal

# Function: signal()

> **signal**<`S`>(`name`, `schema`): [`SignalDef`](../interfaces/SignalDef.md)<`output`<`S`>>

Defined in: [sdk/ts/sdk/src/core/activity.ts:210](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L210)

Defines a signal: a named, typed message a run can park on with `cmd.awaitSignal`,
`cmd.awaitHuman` or [waitFor](waitFor.md), delivered from outside through the host's API.

The content hash covers `name` and the schema as JSON Schema, projected the same way as
an activity's. A host that has the definition registered rejects an inbound payload the
schema does not accept.

## Type Parameters

### S

`S` *extends* `ZodType`<`unknown`, `unknown`, `$ZodTypeInternals`<`unknown`, `unknown`>>

## Parameters

### name

`string`

### schema

`S`

## Returns

[`SignalDef`](../interfaces/SignalDef.md)<`output`<`S`>>

## Example

```ts
import { z } from "zod";
import { signal } from "@oona/vlo";

export const approve = signal("example.approve", z.object({ by: z.string() }));
```
