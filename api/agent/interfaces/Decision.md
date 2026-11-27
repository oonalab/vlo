---
url: /vlo/api/agent/interfaces/Decision.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / Decision

# Interface: Decision

Defined in: [sdk/ts/sdk/src/agent/state.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L26)

What `decide` returned: the next tool to run, or `"done"` with the final answer.

## Properties

### args?

> `optional` **args?**: `unknown`

Defined in: [sdk/ts/sdk/src/agent/state.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L28)

***

### final?

> `optional` **final?**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L30)

***

### rationale?

> `optional` **rationale?**: `string`

Defined in: [sdk/ts/sdk/src/agent/state.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L29)

***

### tool

> **tool**: `string`

Defined in: [sdk/ts/sdk/src/agent/state.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L27)
