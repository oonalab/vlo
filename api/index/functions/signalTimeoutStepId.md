---
url: /vlo/api/index/functions/signalTimeoutStepId.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / signalTimeoutStepId

# Function: signalTimeoutStepId()

> **signalTimeoutStepId**(`id`): `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:184](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L184)

Step id of the timer the kernel pairs with a signal wait `id` that carries a
`timeoutMs`. A `timer` event with this step id means the deadline won the race.

## Parameters

### id

`string`

## Returns

`string`
