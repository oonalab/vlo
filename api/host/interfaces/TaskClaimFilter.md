---
url: /vlo/api/host/interfaces/TaskClaimFilter.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TaskClaimFilter

# Interface: TaskClaimFilter

Defined in: [sdk/ts/sdk/src/journal/types.ts:278](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L278)

Which queues a task claim may take. `queue` is what a puller asks for; `excludeQueues`
is what the push dispatcher leaves alone because pollers own those queues.

## Properties

### excludeQueues?

> `optional` **excludeQueues?**: readonly `string`\[]

Defined in: [sdk/ts/sdk/src/journal/types.ts:282](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L282)

Every queue but these.

***

### queue?

> `optional` **queue?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:280](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L280)

Only this queue.
