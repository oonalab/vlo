---
url: /vlo/api/index/variables/humanTimeoutStepId.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / humanTimeoutStepId

# ~~Variable: humanTimeoutStepId~~

> `const` **humanTimeoutStepId**: (`id`) => `string` = `signalTimeoutStepId`

Defined in: [sdk/ts/sdk/src/core/commands.ts:189](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L189)

Step id of the timer the kernel pairs with a signal wait `id` that carries a
`timeoutMs`. A `timer` event with this step id means the deadline won the race.

## Parameters

### id

`string`

## Returns

`string`

## Deprecated

Use [signalTimeoutStepId](../functions/signalTimeoutStepId.md); same string.
