---
url: /vlo/api/index/functions/fanOutRunsResultsOf.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / fanOutRunsResultsOf

# Function: fanOutRunsResultsOf()

> **fanOutRunsResultsOf**<`O`>(`state`, `target`): [`ChildResult`](../interfaces/ChildResult.md)<`O`>\[]

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-access.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-access.ts#L55)

The outcomes of an earlier [fanOutRuns](fanOutRuns.md) on `target`, in item order: one
[ChildResult](../interfaces/ChildResult.md) per child, whose `output` is `null` unless the child completed. An
empty selection stored `[]`. `O` is the child workflow's completion output type.

## Type Parameters

### O

`O` = [`Json`](../type-aliases/Json.md)

## Parameters

### state

[`SeqState`](../interfaces/SeqState.md)

### target

`string` | { `name`: `string`; }

## Returns

[`ChildResult`](../interfaces/ChildResult.md)<`O`>\[]

## Example

```ts
step(summarise, (state) => ({
  read: fanOutRunsResultsOf<{ ok: boolean }>(state, readSource).filter((r) => r.output?.ok).length,
}))
```
