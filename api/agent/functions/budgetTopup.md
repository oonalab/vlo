---
url: /vlo/api/agent/functions/budgetTopup.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / budgetTopup

# Function: budgetTopup()

> **budgetTopup**(`name?`): [`SignalDef`](../../index/interfaces/SignalDef.md)<[`BudgetTopup`](../interfaces/BudgetTopup.md)>

Defined in: [sdk/ts/sdk/src/agent/budget.ts:28](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/budget.ts#L28)

The signal a parked agent waits on. Pass the result to `agentLoop({ topup })`.

## Parameters

### name?

`string` = `DEFAULT_TOPUP_SIGNAL`

## Returns

[`SignalDef`](../../index/interfaces/SignalDef.md)<[`BudgetTopup`](../interfaces/BudgetTopup.md)>
