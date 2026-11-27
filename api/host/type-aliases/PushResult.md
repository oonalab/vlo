---
url: /vlo/api/host/type-aliases/PushResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PushResult

# Type Alias: PushResult

> **PushResult** = { `accepted`: `true`; `inlineOutput?`: [`Json`](../../index/type-aliases/Json.md); } | { `accepted`: `false`; `fatal?`: `boolean`; `reason`: `string`; }

Defined in: [sdk/ts/sdk/src/host/transport/types.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transport/types.ts#L35)

What a transport's `push` answers. `accepted` means the task is now the worker's: the
dispatcher records it as running. `inlineOutput` is a result the worker returned at once.

## Union Members

### Type Literal

{ `accepted`: `true`; `inlineOutput?`: [`Json`](../../index/type-aliases/Json.md); }

***

### Type Literal

{ `accepted`: `false`; `fatal?`: `boolean`; `reason`: `string`; }

`fatal` means the worker rejected the task itself; retrying would not help.
