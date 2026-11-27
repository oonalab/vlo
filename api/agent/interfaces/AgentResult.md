---
url: /vlo/api/agent/interfaces/AgentResult.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / AgentResult

# Interface: AgentResult

Defined in: [sdk/ts/sdk/src/agent/state.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L60)

The run's output. `exhausted` means the loop stopped on a ceiling, not on a verdict.

## Properties

### candidate

> **candidate**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L61)

***

### exhausted?

> `optional` **exhausted?**: `true`

Defined in: [sdk/ts/sdk/src/agent/state.ts:65](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L65)

***

### iterations

> **iterations**: `number`

Defined in: [sdk/ts/sdk/src/agent/state.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L63)

***

### score?

> `optional` **score?**: `number`

Defined in: [sdk/ts/sdk/src/agent/state.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L62)

***

### spent

> **spent**: [`Spent`](../type-aliases/Spent.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:64](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L64)
