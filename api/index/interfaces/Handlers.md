---
url: /vlo/api/index/interfaces/Handlers.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Handlers

# Interface: Handlers\<S>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L19)

One pure handler per [ReducerEvent](../type-aliases/ReducerEvent.md) type. Each receives the current state and the
event and returns a [Reduction](../type-aliases/Reduction.md). A run receiving an event with no handler fails.

## Type Parameters

### S

`S`

## Methods

### child_done()?

> `optional` **child_done**(`state`, `event`): [`Reduction`](../type-aliases/Reduction.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L29)

A child run started by `cmd.spawn` closed.

#### Parameters

##### state

`S`

##### event

###### child_run_id

`string`

The child's run id.

###### output?

[`Json`](../type-aliases/Json.md)

The child's output; present when it completed.

###### random

`string`

32 hex chars of journaled randomness.

###### status

[`Status`](../type-aliases/Status.md)

`succeeded`, `failed` or `cancelled`, mapped from the child's run status.

###### step_id

`string`

Step id of the spawn.

###### ts_ms

`number`

Journaled event time, epoch milliseconds.

###### type

`"child_done"`

A child run closed.

###### usage_total

[`Usage`](Usage.md)

The run's banked usage including this event.

#### Returns

[`Reduction`](../type-aliases/Reduction.md)<`S`>

***

### signal()?

> `optional` **signal**(`state`, `event`): [`Reduction`](../type-aliases/Reduction.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:25](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L25)

A signal the run was waiting on was delivered.

#### Parameters

##### state

`S`

##### event

###### name

`string`

Signal name.

###### payload

[`Json`](../type-aliases/Json.md)

Validated payload.

###### random

`string`

32 hex chars of journaled randomness.

###### step_id

`string`

Step id of the wait.

###### ts_ms

`number`

Journaled event time, epoch milliseconds.

###### type

`"signal"`

A signal the run was waiting on was delivered.

###### usage_total

[`Usage`](Usage.md)

The run's banked usage including this event.

#### Returns

[`Reduction`](../type-aliases/Reduction.md)<`S`>

***

### started()

> **started**(`state`, `event`): [`Reduction`](../type-aliases/Reduction.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L21)

The first event of a run: `state` is what `init` built from the start input.

#### Parameters

##### state

`S`

##### event

###### input

[`Json`](../type-aliases/Json.md)

The start input, as given to `init`.

###### random

`string`

32 hex chars of journaled randomness — the reducer's only entropy.

###### ts_ms

`number`

Journaled event time, epoch milliseconds — the reducer's only clock.

###### type

`"started"`

The run's first event.

###### usage_total

[`Usage`](Usage.md)

The run's banked usage including this event.

#### Returns

[`Reduction`](../type-aliases/Reduction.md)<`S`>

***

### task_done()

> **task_done**(`state`, `event`): [`Reduction`](../type-aliases/Reduction.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L23)

A task reached a terminal status; `event.output` is set when it `succeeded`.

#### Parameters

##### state

`S`

##### event

###### activity

`string`

Activity name.

###### attempt

`number`

The attempt that produced this result.

###### cause?

[`Cause`](../type-aliases/Cause.md)

Why it did not succeed.

###### error?

`string`

Error message from the worker or host.

###### output?

[`Json`](../type-aliases/Json.md)

Validated output; present when `succeeded`.

###### random

`string`

32 hex chars of journaled randomness.

###### status

[`Status`](../type-aliases/Status.md)

`succeeded`, `failed` or `cancelled`.

###### step_id

`string`

Step id of the task.

###### ts_ms

`number`

Journaled event time, epoch milliseconds.

###### type

`"task_done"`

A task reached a terminal status.

###### usage

[`Usage`](Usage.md)

What this attempt itself consumed; zeroed when the worker reported none.

###### usage_total

[`Usage`](Usage.md)

The run's banked usage including this event.

#### Returns

[`Reduction`](../type-aliases/Reduction.md)<`S`>

***

### timer()?

> `optional` **timer**(`state`, `event`): [`Reduction`](../type-aliases/Reduction.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L27)

A timer opened by `cmd.timer` fired.

#### Parameters

##### state

`S`

##### event

###### random

`string`

32 hex chars of journaled randomness.

###### step_id

`string`

Step id of the timer.

###### ts_ms

`number`

Journaled event time, epoch milliseconds.

###### type

`"timer"`

A timer fired.

###### usage_total

[`Usage`](Usage.md)

The run's banked usage including this event.

#### Returns

[`Reduction`](../type-aliases/Reduction.md)<`S`>
