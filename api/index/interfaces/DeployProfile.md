---
url: /vlo/api/index/interfaces/DeployProfile.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / DeployProfile

# Interface: DeployProfile

Defined in: [sdk/ts/sdk/src/config/define.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L77)

What `vlo deploy` needs to write templates. Never a secret — only names and regions.

## Properties

### bucket?

> `optional` **bucket?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L93)

Bucket for offloaded payloads. Defaults to the bucket named by a `gcs://` `blob` URL.

***

### cron?

> `optional` **cron?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:99](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L99)

Cron expression driving the tick route on serverless targets. Default every minute.

***

### envs?

> `optional` **envs?**: readonly `string`\[]

Defined in: [sdk/ts/sdk/src/config/define.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L95)

Terraform envs this profile is deployed to. Default `["staging", "prod"]`.

***

### namePrefix?

> `optional` **namePrefix?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L89)

First segment of every generated resource name: `<namePrefix>-<env>-<service>`. Must
equal the `prefix` of each entry in the Terraform `local.envs` the templates join.
Default `vlo`.

***

### project?

> `optional` **project?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L81)

Cloud project id, where the target needs one.

***

### region?

> `optional` **region?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L83)

Region the service runs in. Default `europe-west4`.

***

### secretName?

> `optional` **secretName?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L97)

Middle segment of the generated Secret Manager secret ids. Default `vlo`.

***

### service?

> `optional` **service?**: [`Ref`](../type-aliases/Ref.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:91](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L91)

Component name inside the per-env prefix, e.g. `<namePrefix>-<env>-<service>`. Default `vlo`.

***

### target

> **target**: [`DeployTarget`](../type-aliases/DeployTarget.md)

Defined in: [sdk/ts/sdk/src/config/define.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L79)

Which set of templates to render.
