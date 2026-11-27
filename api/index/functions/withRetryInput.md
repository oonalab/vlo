---
url: /vlo/api/index/functions/withRetryInput.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / withRetryInput

# Function: withRetryInput()

> **withRetryInput**<`I`, `O`>(`handler`, `shape`): [`ActivityHandler`](../type-aliases/ActivityHandler.md)<`I`, `O`>

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:126](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L126)

Wraps a handler so attempts after the first receive `shape(input, attempt)` instead of the
journaled input. Use it when repeating the same ask would fail the same way — a model
looping on a long prompt, say — and a smaller or different ask has a chance.

The journaled task input is untouched; only this process's view of it changes, and
`attempt` is journaled, so the same attempt always sees the same input. `shape` must be
pure. The shaped input is not re-validated against the activity's input schema.

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### handler

[`ActivityHandler`](../type-aliases/ActivityHandler.md)<`I`, `O`>

### shape

(`input`, `attempt`) => `I`

## Returns

[`ActivityHandler`](../type-aliases/ActivityHandler.md)<`I`, `O`>

## Example

```ts
defineWorker({
  "brand.synthesize": withRetryInput(synthesize, (input) => ({ ...input, compact: true })),
});
```
