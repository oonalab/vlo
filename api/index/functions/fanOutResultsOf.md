---
url: /vlo/api/index/functions/fanOutResultsOf.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / fanOutResultsOf

# Function: fanOutResultsOf()

> **fanOutResultsOf**<`I`, `O`>(`state`, `target`): `O`\[]

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-access.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-access.ts#L39)

The outputs of an earlier [fanOut](fanOut.md) on `target`, in item order. An empty
selection stored `[]`.

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

`O`\[]

## Example

```ts
step(finish, (state) => ({
  uppers: fanOutResultsOf(state, work).map((output) => output.upper),
  approvedBy: "auto",
}))
```
