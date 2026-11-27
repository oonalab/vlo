---
url: /vlo/api/index/functions/signalOf.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / signalOf

# Function: signalOf()

> **signalOf**<`T`>(`state`, `definition`): `T`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-access.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-access.ts#L73)

The payload an earlier [waitFor](waitFor.md) on `definition` received, typed as the signal's
payload. After an `onTimeout: "continue"` deadline the stored value is `null`, which
this returns as-is; narrow it yourself when that option is in play.

## Type Parameters

### T

`T`

## Parameters

### state

[`SeqState`](../interfaces/SeqState.md)

### definition

[`SignalDef`](../interfaces/SignalDef.md)<`T`>

## Returns

`T`

## Example

```ts
step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by }))
```
