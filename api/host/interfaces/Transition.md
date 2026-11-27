---
url: /vlo/api/host/interfaces/Transition.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Transition

# Interface: Transition

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:121](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L121)

The write-set. Journals apply it atomically and never interpret commands.

## Properties

### completion?

> `optional` **completion?**: [`Completion`](Completion.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:147](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L147)

Present when the run reached a terminal status.

***

### continue_as_new?

> `optional` **continue_as_new?**: `object`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:149](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L149)

Present when the run continued as new; carries the successor's input.

#### input

> **input**: [`Json`](../../index/type-aliases/Json.md)

***

### emits

> **emits**: [`Emit`](Emit.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:145](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L145)

Side-channel emissions.

***

### events

> **events**: [`Envelope`](Envelope.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:133](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L133)

Events to append: the triggering event plus any markers.

***

### kernel_state

> **kernel_state**: [`KernelState`](KernelState.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:125](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L125)

Kernel state after the event.

***

### run

> **run**: [`RunPatch`](RunPatch.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:123](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L123)

Run row patch.

***

### signal_waits

> **signal_waits**: [`SignalWait`](SignalWait.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:143](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L143)

Signal waits to open.

***

### spawns

> **spawns**: [`NewSpawn`](NewSpawn.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:141](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L141)

Child runs to start.

***

### state

> **state**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:127](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L127)

User state after the event, byte-exact JSON.

***

### state_hash

> **state_hash**: `string`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:129](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L129)

Hash of kernel state plus user state.

***

### state_inline

> **state_inline**: `boolean`

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:131](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L131)

Whether `state` is stored inline or offloaded to the blob store.

***

### task_updates

> **task_updates**: [`TaskUpdate`](TaskUpdate.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:137](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L137)

Task rows to update.

***

### tasks

> **tasks**: [`NewTask`](NewTask.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:135](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L135)

Tasks to insert.

***

### timers

> **timers**: [`NewTimer`](NewTimer.md)\[]

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:139](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L139)

Timers to insert.
