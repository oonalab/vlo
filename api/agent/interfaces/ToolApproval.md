---
url: /vlo/api/agent/interfaces/ToolApproval.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / ToolApproval

# Interface: ToolApproval

Defined in: [sdk/ts/sdk/src/agent/approval.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L20)

The reply to an approval request. An empty payload approves, so a signed link's
confirmation form is enough; `approved: false` rejects.

## Properties

### approved?

> `optional` **approved?**: `boolean`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L22)

`false` rejects the call. Absent or `true` approves it.

***

### by?

> `optional` **by?**: `string`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L26)

Who replied.

***

### reason?

> `optional` **reason?**: `string`

Defined in: [sdk/ts/sdk/src/agent/approval.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/approval.ts#L24)

Why, shown to the decider when the call is rejected.
