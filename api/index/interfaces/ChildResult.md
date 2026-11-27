---
url: /vlo/api/index/interfaces/ChildResult.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ChildResult

# Interface: ChildResult\<O>

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:78](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L78)

One child's outcome as [fanOutRuns](../functions/fanOutRuns.md) stores it.

## Type Parameters

### O

`O` = [`Json`](../type-aliases/Json.md)

## Properties

### child_run_id

> **child_run_id**: `string`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:84](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L84)

The child's run id, for a journal read of its own events.

***

### output

> **output**: `O` | `null`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:82](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L82)

The child's completion output; `null` unless it completed.

***

### status

> **status**: [`ChildStatus`](../type-aliases/ChildStatus.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:80](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L80)

`succeeded` for a completed child, else `failed` or `cancelled`.
