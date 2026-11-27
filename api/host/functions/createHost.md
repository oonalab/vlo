---
url: /vlo/api/host/functions/createHost.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / createHost

# Function: createHost()

> **createHost**(`options`): [`Host`](../interfaces/Host.md)

Defined in: [sdk/ts/sdk/src/host/roles.ts:159](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L159)

Builds a host without binding a port or starting it. Nothing is loaded or migrated until
`start()` (or the first `fetch`). A `journal` given as a URL is opened here and closed by
`stop()`; a `Journal` instance is left to its owner.

## Parameters

### options

[`CreateHostOptions`](../interfaces/CreateHostOptions.md)

## Returns

[`Host`](../interfaces/Host.md)

## Example

```ts
import { createClient, createHost, defineWorker } from "@oona/vlo/host";

const host = createHost({
  journal: "sqlite://./.vlo/dev.db",
  workflows: [pipeline],
  activities: [render],
  workers: [defineWorker({ "pull.render": (input: { clip: string }) => ({ rendered: input.clip }) })],
});
await host.start();

const client = createClient({ fetch: host.fetch });
const run = await client.start(pipeline, { clip: "reel" });
await client.waitFor(run.run_id, "completed");
await host.stop();
```
