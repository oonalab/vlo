---
url: /vlo/api/host/functions/runPullWorker.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / runPullWorker

# Function: runPullWorker()

> **runPullWorker**(`options`): `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/worker/pull.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/pull.ts#L71)

Runs until `signal` aborts, then resolves once the tasks in flight have reported. Throws
a `TypeError` when there is no queue to poll. A failed poll goes to `onError` and the loop
retries after 1 s. Runs on the worker side; the host only needs the `api` role.

## Parameters

### options

[`PullWorkerOptions`](../interfaces/PullWorkerOptions.md)

## Returns

`Promise`<`void`>

## Example

```ts
import { defineWorker, runPullWorker } from "@oona/vlo/host";

const abort = new AbortController();
const loop = runPullWorker({
  baseUrl: "https://vlo.example.com",
  token: "control-plane-token",
  worker: defineWorker(
    { "pull.render": (input: { clip: string }) => ({ rendered: input.clip.toUpperCase() }) },
    { queues: ["media"] },
  ),
  waitMs: 5_000,
  signal: abort.signal,
  onError: (error) => console.error(error),
});
process.once("SIGTERM", () => abort.abort());
await loop;
```
