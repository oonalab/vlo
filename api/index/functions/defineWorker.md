---
url: /vlo/api/index/functions/defineWorker.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / defineWorker

# Function: defineWorker()

> **defineWorker**(`impls`, `options?`): [`Worker`](../interfaces/Worker.md)

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:96](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L96)

Defines a worker: a map from activity name to [ActivityHandler](../type-aliases/ActivityHandler.md) plus the queues it
serves. Passed to `createHost({ workers })` for in-process execution, `runPullWorker` for
long-polling, or found by the config loader's `workers` globs.

The worker holds no schemas; validation happens in the reducer (input) and on the host
(output). Throws a `TypeError` when `impls` is empty.

## Parameters

### impls

[`ActivityImpls`](../type-aliases/ActivityImpls.md)

### options?

[`WorkerOptions`](../interfaces/WorkerOptions.md) = `{}`

## Returns

[`Worker`](../interfaces/Worker.md)

## Example

```ts
import { defineWorker } from "@oona/vlo";

export default defineWorker(
  {
    "example.plan": (input: { n: number }) => ({
      items: Array.from({ length: input.n }, (_, i) => `item-${i}`),
    }),
    "example.work": async (input: { item: string }, ctx) => {
      await ctx.heartbeat();
      ctx.reportUsage({ tokens: 12 });
      return { upper: input.item.toUpperCase() };
    },
  },
  { queues: ["default"] },
);
```
