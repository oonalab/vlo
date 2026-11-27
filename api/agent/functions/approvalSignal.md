---
url: /vlo/api/agent/functions/approvalSignal.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / approvalSignal

# Function: approvalSignal()

> **approvalSignal**(`iteration`, `name?`): [`SignalDef`](../../index/interfaces/SignalDef.md)<[`ToolApproval`](../interfaces/ToolApproval.md)>

Defined in: [sdk/ts/sdk/src/agent/approval.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L59)

The signal the gated call of `iteration` waits on. Pass it to `client.signal` or
`client.signalLink`; the iteration is the suffix of the wait's step id, `approve#<i>`.

## Parameters

### iteration

`number`

### name?

`string` = `DEFAULT_APPROVAL_SIGNAL`

## Returns

[`SignalDef`](../../index/interfaces/SignalDef.md)<[`ToolApproval`](../interfaces/ToolApproval.md)>

## Example

```ts
await client.signal(runId, approvalSignal(2), { approved: false, reason: "wrong audience" });
```
