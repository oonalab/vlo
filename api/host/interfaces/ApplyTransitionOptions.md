---
url: /vlo/api/host/interfaces/ApplyTransitionOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ApplyTransitionOptions

# Interface: ApplyTransitionOptions

Defined in: [sdk/ts/sdk/src/journal/types.ts:243](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L243)

Host-side decisions `applyTransition` needs on top of the kernel's write-set.

## Properties

### bundleDigest?

> `optional` **bundleDigest?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:251](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L251)

Defaults to the run's `component_digest`.

***

### childRuns?

> `optional` **childRuns?**: [`NewRunRow`](NewRunRow.md)\[]

Defined in: [sdk/ts/sdk/src/journal/types.ts:253](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L253)

Child runs the host derived from `transition.spawns`; journals never interpret commands.

***

### nowMs

> **nowMs**: `number`

Defined in: [sdk/ts/sdk/src/journal/types.ts:245](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L245)

Timestamp for every row written, epoch milliseconds.

***

### outputRef?

> `optional` **outputRef?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:249](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L249)

Set when the completion output was offloaded; stores `output_ref`.

***

### stateRef?

> `optional` **stateRef?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:247](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L247)

Set when the user state was offloaded to the blob store; stores `state_ref`.

***

### successorRun?

> `optional` **successorRun?**: [`NewRunRow`](NewRunRow.md)

Defined in: [sdk/ts/sdk/src/journal/types.ts:259](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L259)

The successor the host derived from `transition.continue_as_new`. Inserted as a `created`
row and linked back by setting `continued_to` on the run being closed, in the same
transaction.
