---
url: /vlo/api/agent/interfaces/DecisionOptions.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / DecisionOptions

# Interface: DecisionOptions\<I>

Defined in: [sdk/ts/sdk/src/agent/decision.ts:14](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L14)

`@oona/vlo/agent` — the agent layer, built on the authoring surface of `@oona/vlo`.

An agent is the reducer model in its purest form: state is memory plus budget, the event
is an observation, the command is the next tool call. Nothing here does I/O; `agentLoop`
returns a `WorkflowDef` you hand to `defineWorkflow`.

## Type Parameters

### I

`I` *extends* `z.ZodType`

## Properties

### input

> **input**: `I`

Defined in: [sdk/ts/sdk/src/agent/decision.ts:16](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L16)

What the decider is shown. `agentLoop` sends `{ goal, memory, candidate, score }`.

***

### queue?

> `optional` **queue?**: `string`

Defined in: [sdk/ts/sdk/src/agent/decision.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L20)

***

### retry?

> `optional` **retry?**: [`RetryOptions`](../../index/interfaces/RetryOptions.md)

Defined in: [sdk/ts/sdk/src/agent/decision.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L19)

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/agent/decision.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L22)

Wall-clock ceiling for one decision; the host fails the task with `cause: "timeout"`.

***

### tools

> **tools**: `Record`<`string`, [`Activity`](../../index/interfaces/Activity.md)>

Defined in: [sdk/ts/sdk/src/agent/decision.ts:18](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L18)

The tools it may pick from, keyed by the name it returns in `tool`.
