---
url: /vlo/api/host/functions/serve.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / serve

# Function: serve()

> **serve**(`options`): `Promise`<[`ServeResult`](../interfaces/ServeResult.md)>

Defined in: [sdk/ts/sdk/src/host/roles.ts:305](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L305)

Binds a port, tells the host its own URL, then starts it. `publicUrl` is set to the
listener's URL unless the options give one, so pushed tasks carry a working `complete_url`.

## Parameters

### options

[`ServeOptions`](../interfaces/ServeOptions.md)

## Returns

`Promise`<[`ServeResult`](../interfaces/ServeResult.md)>

## Example

```ts
import { serve } from "@oona/vlo/host";

const server = await serve({
  journal: "postgres://user:pass@localhost/app",
  workflows: [pipeline],
  activities: [render],
  auth: { token: "control-plane-token" },
  port: 4100,
});
console.log(server.url); // http://127.0.0.1:4100
await server.close();
```
