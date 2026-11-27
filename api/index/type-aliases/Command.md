---
url: /vlo/api/index/type-aliases/Command.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Command

# Type Alias: Command

> **Command** = { `activity`: `string`; `id?`: `string`; `input`: [`Json`](Json.md); `lease_ttl_ms?`: `number`; `queue?`: `string`; `retry?`: [`RetryPolicy`](../interfaces/RetryPolicy.md); `schema_ref?`: `string`; `timeout_ms?`: `number`; `type`: `"task"`; } | { `fire_at_ms?`: `number`; `fire_in_ms?`: `number`; `id?`: `string`; `type`: `"timer"`; } | { `id?`: `string`; `input`: [`Json`](Json.md); `type`: `"spawn"`; `workflow`: `string`; } | { `id?`: `string`; `name`: `string`; `schema_ref?`: `string`; `timeout_ms?`: `number`; `type`: `"await_signal"`; } | { `channel`: `string`; `data`: [`Json`](Json.md); `type`: `"emit"`; } | { `output`: [`Json`](Json.md); `type`: `"complete"`; } | { `input`: [`Json`](Json.md); `type`: `"continue_as_new"`; }

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:136](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L136)

A command as a reducer returns it and the kernel validates it. Build them with `cmd.*`.
`task`, `timer`, `spawn` and `await_signal` open a step and take an optional step `id`
(default: kernel-derived, `${type}#${step_no}`); `complete` and `continue_as_new` must be last.

## Union Members

### Type Literal

{ `activity`: `string`; `id?`: `string`; `input`: [`Json`](Json.md); `lease_ttl_ms?`: `number`; `queue?`: `string`; `retry?`: [`RetryPolicy`](../interfaces/RetryPolicy.md); `schema_ref?`: `string`; `timeout_ms?`: `number`; `type`: `"task"`; }

#### activity

> **activity**: `string`

Activity name.

#### id?

> `optional` **id?**: `string`

Explicit step id.

#### input

> **input**: [`Json`](Json.md)

Validated task input.

#### lease_ttl_ms?

> `optional` **lease_ttl_ms?**: `number`

Lease per attempt, in milliseconds. Default: the kernel's own.

#### queue?

> `optional` **queue?**: `string`

Queue to dispatch on. Default `"default"`.

#### retry?

> `optional` **retry?**: [`RetryPolicy`](../interfaces/RetryPolicy.md)

Retry policy. Default: the kernel's own.

#### schema_ref?

> `optional` **schema_ref?**: `string`

`name@hash` of the activity, recorded on the step's events.

#### timeout_ms?

> `optional` **timeout_ms?**: `number`

Wall-clock budget for one attempt: the worker aborts at it, the host reaps past it.

#### type

> **type**: `"task"`

Run an activity.

***

### Type Literal

{ `fire_at_ms?`: `number`; `fire_in_ms?`: `number`; `id?`: `string`; `type`: `"timer"`; }

#### fire_at_ms?

> `optional` **fire_at_ms?**: `number`

Absolute epoch time, in milliseconds.

#### fire_in_ms?

> `optional` **fire_in_ms?**: `number`

Delay from the reduced event's `ts_ms`, in milliseconds.

#### id?

> `optional` **id?**: `string`

Explicit step id.

#### type

> **type**: `"timer"`

Fire a `timer` event. Exactly one of `fire_in_ms` / `fire_at_ms`.

***

### Type Literal

{ `id?`: `string`; `input`: [`Json`](Json.md); `type`: `"spawn"`; `workflow`: `string`; }

#### id?

> `optional` **id?**: `string`

Explicit step id.

#### input

> **input**: [`Json`](Json.md)

The child's start input.

#### type

> **type**: `"spawn"`

Start a child run.

#### workflow

> **workflow**: `string`

Workflow name.

***

### Type Literal

{ `id?`: `string`; `name`: `string`; `schema_ref?`: `string`; `timeout_ms?`: `number`; `type`: `"await_signal"`; }

#### id?

> `optional` **id?**: `string`

Explicit step id.

#### name

> **name**: `string`

Signal name.

#### schema_ref?

> `optional` **schema_ref?**: `string`

`name@hash` of the signal.

#### timeout_ms?

> `optional` **timeout_ms?**: `number`

Recorded as the wait's `expires_at_ms`; not enforced by the host.

#### type

> **type**: `"await_signal"`

Park until a signal is delivered.

***

### Type Literal

{ `channel`: `string`; `data`: [`Json`](Json.md); `type`: `"emit"`; }

#### channel

> **channel**: `string`

Channel name.

#### data

> **data**: [`Json`](Json.md)

The payload.

#### type

> **type**: `"emit"`

Publish on a side channel; never journaled.

***

### Type Literal

{ `output`: [`Json`](Json.md); `type`: `"complete"`; }

#### output

> **output**: [`Json`](Json.md)

The run's output.

#### type

> **type**: `"complete"`

Close the run as `completed`.

***

### Type Literal

{ `input`: [`Json`](Json.md); `type`: `"continue_as_new"`; }

#### input

> **input**: [`Json`](Json.md)

Start input for the successor run.

#### type

> **type**: `"continue_as_new"`

Close the run as `continued`.
