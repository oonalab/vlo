---
url: /vlo/api/agent/interfaces/AgentState.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / AgentState

# Interface: AgentState

Defined in: [sdk/ts/sdk/src/agent/state.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L45)

## Properties

### budget

> **budget**: [`Budget`](Budget.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L55)

***

### candidate?

> `optional` **candidate?**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L51)

***

### goal

> **goal**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L47)

***

### iteration

> **iteration**: `number`

Defined in: [sdk/ts/sdk/src/agent/state.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L49)

Completed cycles, and the step-id suffix of the one in flight.

***

### memory

> **memory**: [`Observation`](Observation.md)\[]

Defined in: [sdk/ts/sdk/src/agent/state.ts:50](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L50)

***

### pending?

> `optional` **pending?**: `object`

Defined in: [sdk/ts/sdk/src/agent/state.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L54)

The tool chosen this iteration (awaiting approval or dispatched), so its result can be attributed to it.

#### args

> **args**: [`Json`](../../index/type-aliases/Json.md)

#### tool

> **tool**: `string`

***

### phase

> **phase**: [`AgentPhase`](../type-aliases/AgentPhase.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:46](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L46)

***

### score?

> `optional` **score?**: `number`

Defined in: [sdk/ts/sdk/src/agent/state.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L52)

***

### spent

> **spent**: [`Spent`](../type-aliases/Spent.md)

Defined in: [sdk/ts/sdk/src/agent/state.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L56)
