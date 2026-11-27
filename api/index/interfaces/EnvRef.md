---
url: /vlo/api/index/interfaces/EnvRef.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / EnvRef

# Interface: EnvRef

Defined in: [sdk/ts/sdk/src/config/define.ts:11](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L11)

A reference to an environment variable, as [env](../functions/env.md) builds it. Resolved at load time.

## Properties

### \_\_env

> `readonly` **\_\_env**: `string`

Defined in: [sdk/ts/sdk/src/config/define.ts:13](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L13)

Name of the environment variable.

***

### optional?

> `readonly` `optional` **optional?**: `boolean`

Defined in: [sdk/ts/sdk/src/config/define.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L15)

When `true`, an unset or empty variable resolves to "absent" instead of failing the load.
