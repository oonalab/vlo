---
url: /vlo/api/index/type-aliases/ActivityHandler.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ActivityHandler

# Type Alias: ActivityHandler\<I, O>

> **ActivityHandler**<`I`, `O`> = (`input`, `ctx`) => `O` | `Promise`<`O`>

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L45)

The implementation of one activity. `input` has already passed the activity's input
schema; the return value is validated against its output schema by the host. A throw
fails the attempt as retryable; aborting on `ctx.signal` is how a handler cooperates
with a timeout, a lost lease or a shutdown.

## Type Parameters

### I

`I` = [`Json`](Json.md)

### O

`O` = `unknown`

## Parameters

### input

`I`

### ctx

[`TaskContext`](../interfaces/TaskContext.md)

## Returns

`O` | `Promise`<`O`>
