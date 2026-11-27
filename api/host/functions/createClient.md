---
url: /vlo/api/host/functions/createClient.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / createClient

# Function: createClient()

> **createClient**(`options?`): [`Client`](../interfaces/Client.md)

Defined in: [sdk/ts/sdk/src/client/index.ts:158](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L158)

Builds a [Client](../interfaces/Client.md). With no options it talks to `http://vlo.localhost` over
`globalThis.fetch`, which is only useful together with `fetch: host.fetch`.

## Parameters

### options?

[`ClientOptions`](../interfaces/ClientOptions.md) = `{}`

## Returns

[`Client`](../interfaces/Client.md)

## Example

```ts
import { createClient } from "@oona/vlo/host";

const client = createClient({ baseUrl: "http://127.0.0.1:4100", token: "control-plane-token" });
const run = await client.start(pipeline, { clip: "reel" });
await client.signal(run.run_id, "approve", { by: "me" });
const done = await client.waitFor(run.run_id, "completed");
console.log(done.output);
```
