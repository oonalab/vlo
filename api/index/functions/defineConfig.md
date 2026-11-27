---
url: /vlo/api/index/functions/defineConfig.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / defineConfig

# Function: defineConfig()

> **defineConfig**(`config`): [`VloConfig`](../interfaces/VloConfig.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:169](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L169)

Types and checks a `vlo.config.ts` and returns it unchanged for `export default`.

Throws a `TypeError` when `profiles` is empty. Values wrapped with [env](env.md) are
resolved later, when the CLI loads the profile.

## Parameters

### config

[`VloConfig`](../interfaces/VloConfig.md)

## Returns

[`VloConfig`](../interfaces/VloConfig.md)

## Example

```ts
import { defineConfig, env } from "@oona/vlo";

export default defineConfig({
  workflows: ["./workflows/*.workflow.ts"],
  workers: ["./workers/*.worker.ts"],
  profiles: {
    local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
    prod: {
      journal: env("DATABASE_URL"),
      auth: { token: env("VLO_TOKEN") },
      roles: ["orchestrator", "api"],
      queues: { media: { mode: "pull" } },
      dispatcher: { mode: "manual" },
      deploy: { target: "vercel", cron: "* * * * *" },
    },
  },
});
```
