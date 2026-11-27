---
url: /vlo/api/host/functions/handler.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / handler

# Function: handler()

> **handler**(`options`): `object`

Defined in: [sdk/ts/sdk/src/host/roles.ts:341](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/roles.ts#L341)

Next route file: `export const { GET, POST } = handler({ … })`. The host is created on the
first request and shared by every request after, so a serverless function pays for the
kernel load once per instance. Pair it with `dispatcher: { mode: "manual" }` and a cron on
`POST /v1/timers/tick`.

## Parameters

### options

[`CreateHostOptions`](../interfaces/CreateHostOptions.md)

## Returns

`object`

### GET

> **GET**: [`FetchHandler`](../type-aliases/FetchHandler.md)

### POST

> **POST**: [`FetchHandler`](../type-aliases/FetchHandler.md)

## Example

```ts
// app/api/vlo/[[...path]]/route.ts
import { handler } from "@oona/vlo/host";

export const { GET, POST } = handler({
  journal: process.env.DATABASE_URL ?? "sqlite://./.vlo/dev.db",
  workflows: [pipeline],
  activities: [render],
  basePath: "/api/vlo",
  dispatcher: { mode: "manual" },
});
```
