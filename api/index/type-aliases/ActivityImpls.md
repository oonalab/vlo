---
url: /vlo/api/index/type-aliases/ActivityImpls.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ActivityImpls

# Type Alias: ActivityImpls

> **ActivityImpls** = `Record`<`string`, [`ActivityHandler`](ActivityHandler.md)<`never`, `unknown`>>

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L51)

Handler inputs are contravariant, so `never` accepts any concretely typed handler.
