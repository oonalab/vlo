---
url: /vlo/api/index/interfaces/FanState.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / FanState

# Interface: FanState

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:7](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L7)

Progress of a [fanOut](../functions/fanOut.md) or [fanOutRuns](../functions/fanOutRuns.md) phase in flight; absent from [SeqState](SeqState.md) otherwise.

## Properties

### activity

> **activity**: `string`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:9](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L9)

Name of the activity or workflow being fanned out.

***

### next

> **next**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:13](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L13)

Index of the next item to dispatch.

***

### outputs

> **outputs**: [`Json`](../type-aliases/Json.md)\[]

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L17)

Outputs by item index; `null` until that item's task or child run settles.

***

### outstanding

> **outstanding**: `string`\[]

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L15)

Step ids currently in flight.

***

### total

> **total**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:11](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L11)

Number of items `select` returned.
