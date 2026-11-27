---
url: /vlo/api/index/interfaces/VloConfig.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / VloConfig

# Interface: VloConfig

Defined in: [sdk/ts/sdk/src/config/define.ts:127](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L127)

The shape of `vlo.config.ts`'s default export; build it with [defineConfig](../functions/defineConfig.md).

## Properties

### activities?

> `optional` **activities?**: `string` | readonly `string`\[]

Defined in: [sdk/ts/sdk/src/config/define.ts:133](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L133)

Optional: modules exporting `activity()` / `signal()` definitions to register.

***

### profiles

> **profiles**: `Record`<`string`, [`Profile`](Profile.md)>

Defined in: [sdk/ts/sdk/src/config/define.ts:139](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L139)

Named environments; at least one is required. `vlo dev` picks `local` when present, else
the only profile, unless `--profile` / `VLO_PROFILE` names one; `serve`, `doctor` and
`deploy` always need a name.

***

### workers?

> `optional` **workers?**: `string` | readonly `string`\[]

Defined in: [sdk/ts/sdk/src/config/define.ts:131](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L131)

Globs of modules exporting [defineWorker](../functions/defineWorker.md) results.

***

### workflows

> **workflows**: `string` | readonly `string`\[]

Defined in: [sdk/ts/sdk/src/config/define.ts:129](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L129)

Globs, relative to the config file. Every matching module is imported.
