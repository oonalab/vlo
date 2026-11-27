---
url: /vlo/api/agent/interfaces/AgentLoopOptions.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / AgentLoopOptions

# Interface: AgentLoopOptions

Defined in: [sdk/ts/sdk/src/agent/loop.ts:44](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L44)

## Properties

### approval?

> `optional` **approval?**: [`ApprovalOptions`](ApprovalOptions.md)

Defined in: [sdk/ts/sdk/src/agent/loop.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L59)

Tools that wait for a person's yes before they run. A rejected call becomes an
observation and the decider chooses again. See [ApprovalOptions](ApprovalOptions.md).

***

### budget

> **budget**: [`Budget`](Budget.md)

Defined in: [sdk/ts/sdk/src/agent/loop.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L53)

***

### decide

> **decide**: [`Activity`](../../index/interfaces/Activity.md)

Defined in: [sdk/ts/sdk/src/agent/loop.ts:46](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L46)

Picks the next tool. Build it with `decision(...)`, or hand-roll the same output shape.

***

### evaluate?

> `optional` **evaluate?**: [`Activity`](../../index/interfaces/Activity.md)<`unknown`, `unknown`>

Defined in: [sdk/ts/sdk/src/agent/loop.ts:50](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L50)

Scores the candidate a tool produced. Its output is `number` or `{ score: number }`.

***

### maxIterations?

> `optional` **maxIterations?**: `number`

Defined in: [sdk/ts/sdk/src/agent/loop.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L60)

***

### memoryLimit?

> `optional` **memoryLimit?**: `number`

Defined in: [sdk/ts/sdk/src/agent/loop.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L62)

Observations kept in state; older ones are dropped so the checkpoint stays bounded.

***

### threshold?

> `optional` **threshold?**: `number`

Defined in: [sdk/ts/sdk/src/agent/loop.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L52)

Score at or above which the run completes. Without one, only `decide` can finish.

***

### tools

> **tools**: `Record`<`string`, [`Activity`](../../index/interfaces/Activity.md)>

Defined in: [sdk/ts/sdk/src/agent/loop.ts:48](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L48)

Dispatchable tools, keyed by the name `decide` returns.

***

### topup?

> `optional` **topup?**: [`SignalDef`](../../index/interfaces/SignalDef.md)<[`BudgetTopup`](BudgetTopup.md)>

Defined in: [sdk/ts/sdk/src/agent/loop.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/loop.ts#L54)
