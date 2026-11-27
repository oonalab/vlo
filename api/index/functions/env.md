---
url: /vlo/api/index/functions/env.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / env

# Function: env()

> **env**(`name`, `options?`): [`EnvRef`](../interfaces/EnvRef.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L43)

Refers to an environment variable by name so a secret never sits in `vlo.config.ts`.

The value is read when the profile is loaded, not when `env` is called. An unset or empty
variable fails the load with a message naming the variable, unless `optional` is `true`,
in which case the field is simply absent.

## Parameters

### name

`string`

### options?

#### optional?

`boolean`

## Returns

[`EnvRef`](../interfaces/EnvRef.md)

## Example

```ts
import { defineConfig, env } from "@oona/vlo";

export default defineConfig({
  workflows: ["*.workflow.ts"],
  profiles: {
    prod: {
      journal: env("DATABASE_URL"),
      auth: { token: env("VLO_TOKEN"), pushSecret: env("VLO_PUSH_SECRET", { optional: true }) },
    },
  },
});
```
