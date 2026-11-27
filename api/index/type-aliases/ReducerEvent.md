---
url: /vlo/api/index/type-aliases/ReducerEvent.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ReducerEvent

# Type Alias: ReducerEvent

> **ReducerEvent** = { `input`: [`Json`](Json.md); `random`: `string`; `ts_ms`: `number`; `type`: `"started"`; `usage_total`: [`Usage`](../interfaces/Usage.md); } | { `activity`: `string`; `attempt`: `number`; `cause?`: [`Cause`](Cause.md); `error?`: `string`; `output?`: [`Json`](Json.md); `random`: `string`; `status`: [`Status`](Status.md); `step_id`: `string`; `ts_ms`: `number`; `type`: `"task_done"`; `usage`: [`Usage`](../interfaces/Usage.md); `usage_total`: [`Usage`](../interfaces/Usage.md); } | { `name`: `string`; `payload`: [`Json`](Json.md); `random`: `string`; `step_id`: `string`; `ts_ms`: `number`; `type`: `"signal"`; `usage_total`: [`Usage`](../interfaces/Usage.md); } | { `random`: `string`; `step_id`: `string`; `ts_ms`: `number`; `type`: `"timer"`; `usage_total`: [`Usage`](../interfaces/Usage.md); } | { `child_run_id`: `string`; `output?`: [`Json`](Json.md); `random`: `string`; `status`: [`Status`](Status.md); `step_id`: `string`; `ts_ms`: `number`; `type`: `"child_done"`; `usage_total`: [`Usage`](../interfaces/Usage.md); }

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:241](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L241)

`usage_total` rides on every variant: the run's banked total *including* this event, so a
reducer can decide on a budget without keeping its own tally.

## Union Members

### Type Literal

{ `input`: [`Json`](Json.md); `random`: `string`; `ts_ms`: `number`; `type`: `"started"`; `usage_total`: [`Usage`](../interfaces/Usage.md); }

#### input

> **input**: [`Json`](Json.md)

The start input, as given to `init`.

#### random

> **random**: `string`

32 hex chars of journaled randomness — the reducer's only entropy.

#### ts_ms

> **ts_ms**: `number`

Journaled event time, epoch milliseconds — the reducer's only clock.

#### type

> **type**: `"started"`

The run's first event.

#### usage_total

> **usage_total**: [`Usage`](../interfaces/Usage.md)

The run's banked usage including this event.

***

### Type Literal

{ `activity`: `string`; `attempt`: `number`; `cause?`: [`Cause`](Cause.md); `error?`: `string`; `output?`: [`Json`](Json.md); `random`: `string`; `status`: [`Status`](Status.md); `step_id`: `string`; `ts_ms`: `number`; `type`: `"task_done"`; `usage`: [`Usage`](../interfaces/Usage.md); `usage_total`: [`Usage`](../interfaces/Usage.md); }

#### activity

> **activity**: `string`

Activity name.

#### attempt

> **attempt**: `number`

The attempt that produced this result.

#### cause?

> `optional` **cause?**: [`Cause`](Cause.md)

Why it did not succeed.

#### error?

> `optional` **error?**: `string`

Error message from the worker or host.

#### output?

> `optional` **output?**: [`Json`](Json.md)

Validated output; present when `succeeded`.

#### random

> **random**: `string`

32 hex chars of journaled randomness.

#### status

> **status**: [`Status`](Status.md)

`succeeded`, `failed` or `cancelled`.

#### step_id

> **step_id**: `string`

Step id of the task.

#### ts_ms

> **ts_ms**: `number`

Journaled event time, epoch milliseconds.

#### type

> **type**: `"task_done"`

A task reached a terminal status.

#### usage

> **usage**: [`Usage`](../interfaces/Usage.md)

What this attempt itself consumed; zeroed when the worker reported none.

#### usage_total

> **usage_total**: [`Usage`](../interfaces/Usage.md)

The run's banked usage including this event.

***

### Type Literal

{ `name`: `string`; `payload`: [`Json`](Json.md); `random`: `string`; `step_id`: `string`; `ts_ms`: `number`; `type`: `"signal"`; `usage_total`: [`Usage`](../interfaces/Usage.md); }

#### name

> **name**: `string`

Signal name.

#### payload

> **payload**: [`Json`](Json.md)

Validated payload.

#### random

> **random**: `string`

32 hex chars of journaled randomness.

#### step_id

> **step_id**: `string`

Step id of the wait.

#### ts_ms

> **ts_ms**: `number`

Journaled event time, epoch milliseconds.

#### type

> **type**: `"signal"`

A signal the run was waiting on was delivered.

#### usage_total

> **usage_total**: [`Usage`](../interfaces/Usage.md)

The run's banked usage including this event.

***

### Type Literal

{ `random`: `string`; `step_id`: `string`; `ts_ms`: `number`; `type`: `"timer"`; `usage_total`: [`Usage`](../interfaces/Usage.md); }

#### random

> **random**: `string`

32 hex chars of journaled randomness.

#### step_id

> **step_id**: `string`

Step id of the timer.

#### ts_ms

> **ts_ms**: `number`

Journaled event time, epoch milliseconds.

#### type

> **type**: `"timer"`

A timer fired.

#### usage_total

> **usage_total**: [`Usage`](../interfaces/Usage.md)

The run's banked usage including this event.

***

### Type Literal

{ `child_run_id`: `string`; `output?`: [`Json`](Json.md); `random`: `string`; `status`: [`Status`](Status.md); `step_id`: `string`; `ts_ms`: `number`; `type`: `"child_done"`; `usage_total`: [`Usage`](../interfaces/Usage.md); }

#### child_run_id

> **child_run_id**: `string`

The child's run id.

#### output?

> `optional` **output?**: [`Json`](Json.md)

The child's output; present when it completed.

#### random

> **random**: `string`

32 hex chars of journaled randomness.

#### status

> **status**: [`Status`](Status.md)

`succeeded`, `failed` or `cancelled`, mapped from the child's run status.

#### step_id

> **step_id**: `string`

Step id of the spawn.

#### ts_ms

> **ts_ms**: `number`

Journaled event time, epoch milliseconds.

#### type

> **type**: `"child_done"`

A child run closed.

#### usage_total

> **usage_total**: [`Usage`](../interfaces/Usage.md)

The run's banked usage including this event.
