---
url: /vlo/api/index/functions/resultOf.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / resultOf

# Function: resultOf()

> **resultOf**<`I`, `O`>(`state`, `target`): `O`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-access.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-access.ts#L23)

The output of an earlier [step](step.md) on `target`, typed as the activity's output.

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### state

[`SeqState`](../interfaces/SeqState.md)

### target

[`Activity`](../interfaces/Activity.md)<`I`, `O`>

## Returns

`O`

## Example

```ts
step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" }))
```
