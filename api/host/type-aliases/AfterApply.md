---
url: /vlo/api/host/type-aliases/AfterApply.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / AfterApply

# Type Alias: AfterApply

> **AfterApply** = (`tx`, `outcome`) => `Promise`<`void`>

Defined in: [sdk/ts/sdk/src/host/transition.ts:66](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L66)

Extra journal work to commit atomically with the transition.

## Parameters

### tx

[`JournalTx`](../interfaces/JournalTx.md)

### outcome

[`TxOutcome`](../interfaces/TxOutcome.md)

## Returns

`Promise`<`void`>
