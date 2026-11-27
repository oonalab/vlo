---
url: /vlo/api/index/interfaces/AwaitHumanOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / AwaitHumanOptions

# Interface: AwaitHumanOptions

Defined in: [sdk/ts/sdk/src/core/commands.ts:171](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L171)

## Properties

### context?

> `optional` **context?**: [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/commands.ts:177](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L177)

Rendered by whatever asks the human — "context travels with the ask".

***

### id

> **id**: `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:173](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L173)

Step id of the wait. The deadline timer is `${id}:timeout`, so it is required.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/commands.ts:175](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L175)

Deadline for the reply. Without one the run waits forever.
