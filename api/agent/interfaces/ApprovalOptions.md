---
url: /vlo/api/agent/interfaces/ApprovalOptions.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / ApprovalOptions

# Interface: ApprovalOptions

Defined in: [sdk/ts/sdk/src/agent/approval.ts:30](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L30)

What `agentLoop({ approval })` takes.

## Properties

### name?

> `optional` **name?**: `string`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L34)

Signal name prefix. Default [DEFAULT_APPROVAL_SIGNAL](../variables/DEFAULT_APPROVAL_SIGNAL.md).

***

### onTimeout?

> `optional` **onTimeout?**: `"fail"` | `"reject"`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L41)

What an unanswered request becomes: `"reject"` (default) tells the decider the call was
not approved and carries on; `"fail"` fails the run.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L36)

How long to wait for a reply. Without one the run waits until somebody answers.

***

### tools

> **tools**: readonly `string`\[]

Defined in: [sdk/ts/sdk/src/agent/approval.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L32)

Names of the tools that need a yes before they run. Each must be a key of `tools`.
