---
url: /vlo/api/host/interfaces/NewRunRow.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / NewRunRow

# Interface: NewRunRow

Defined in: [sdk/ts/sdk/src/journal/types.ts:201](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L201)

What `createRun` inserts; timestamps and counters are filled by the journal.

## Properties

### component_digest

> **component_digest**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:209](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L209)

Digest of the workflow bundle.

***

### continued_from?

> `optional` **continued_from?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:217](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L217)

The run this one continues from.

***

### input?

> `optional` **input?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:219](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L219)

Inline start input, byte-exact JSON.

***

### input_ref?

> `optional` **input_ref?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:221](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L221)

Blob reference for an offloaded start input.

***

### namespace?

> `optional` **namespace?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:205](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L205)

Namespace. Default `"default"`.

***

### parent_run_id?

> `optional` **parent_run_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:213](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L213)

Parent run, for a spawned child.

***

### parent_step_id?

> `optional` **parent_step_id?**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:215](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L215)

The parent's spawning step.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:203](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L203)

Primary key.

***

### search?

> `optional` **search?**: `Record`<`string`, [`Json`](../../index/type-aliases/Json.md)>

Defined in: [sdk/ts/sdk/src/journal/types.ts:223](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L223)

Caller-supplied search attributes.

***

### status

> **status**: `"created"`

Defined in: [sdk/ts/sdk/src/journal/types.ts:211](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L211)

Always `created`; the outbox starts the run.

***

### workflow

> **workflow**: `string`

Defined in: [sdk/ts/sdk/src/journal/types.ts:207](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/types.ts#L207)

Workflow name.
