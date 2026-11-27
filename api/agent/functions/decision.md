---
url: /vlo/api/agent/functions/decision.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / decision

# Function: decision()

> **decision**<`I`>(`name`, `options`): [`Activity`](../../index/interfaces/Activity.md)<`output`<`I`>, [`Decision`](../interfaces/Decision.md)>

Defined in: [sdk/ts/sdk/src/agent/decision.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/decision.ts#L36)

`@oona/vlo/agent` — the agent layer, built on the authoring surface of `@oona/vlo`.

An agent is the reducer model in its purest form: state is memory plus budget, the event
is an observation, the command is the next tool call. Nothing here does I/O; `agentLoop`
returns a `WorkflowDef` you hand to `defineWorkflow`.

## Type Parameters

### I

`I` *extends* `ZodType`<`unknown`, `unknown`, `$ZodTypeInternals`<`unknown`, `unknown`>>

## Parameters

### name

`string`

### options

[`DecisionOptions`](../interfaces/DecisionOptions.md)<`I`>

## Returns

[`Activity`](../../index/interfaces/Activity.md)<`output`<`I`>, [`Decision`](../interfaces/Decision.md)>
