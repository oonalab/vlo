---
url: /vlo/api/index/type-aliases/SeqStep.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / SeqStep

# Type Alias: SeqStep

> **SeqStep** = { `activity`: [`ErasedActivity`](ErasedActivity.md); `id?`: `string`; `key`: `string`; `kind`: `"step"`; `mapInput?`: (`state`) => [`Json`](Json.md); `onFailure?`: [`OnFailure`](OnFailure.md); `when?`: (`state`) => `boolean`; } | { `activity`: [`ErasedActivity`](ErasedActivity.md); `concurrency`: `number`; `key`: `string`; `kind`: `"fan_out"`; `onFailure?`: [`OnFailure`](OnFailure.md); `select`: (`state`) => [`Json`](Json.md)\[]; } | { `concurrency`: `number`; `key`: `string`; `kind`: `"fan_out_runs"`; `onFailure?`: [`OnFailure`](OnFailure.md); `select`: (`state`) => [`Json`](Json.md)\[]; `workflow`: `string`; } | { `context?`: [`Json`](Json.md); `key`: `string`; `kind`: `"wait_for"`; `onTimeout?`: [`OnTimeout`](OnTimeout.md); `signal`: [`SignalDef`](../interfaces/SignalDef.md)<[`Json`](Json.md)>; `timeoutMs?`: `number`; } | { `kind`: `"sleep"`; `ms`: `number`; }

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L97)

One phase of a [sequence](../functions/sequence.md), as built by [step](../functions/step.md), [fanOut](../functions/fanOut.md), [fanOutRuns](../functions/fanOutRuns.md),
[waitFor](../functions/waitFor.md) or [sleep](../functions/sleep.md). Treat it as opaque; the shape is exposed for inspection only.

## Union Members

### Type Literal

{ `activity`: [`ErasedActivity`](ErasedActivity.md); `id?`: `string`; `key`: `string`; `kind`: `"step"`; `mapInput?`: (`state`) => [`Json`](Json.md); `onFailure?`: [`OnFailure`](OnFailure.md); `when?`: (`state`) => `boolean`; }

#### activity

> `readonly` **activity**: [`ErasedActivity`](ErasedActivity.md)

The activity to run.

#### id?

> `readonly` `optional` **id?**: `string`

Explicit step id; absent means kernel-derived.

#### key

> `readonly` **key**: `string`

Key in `results`: the activity name.

#### kind

> `readonly` **kind**: `"step"`

A single task.

#### mapInput?

> `readonly` `optional` **mapInput?**: (`state`) => [`Json`](Json.md)

Builds the task input from state; absent means "the previous phase's value".

##### Parameters

###### state

[`SeqState`](../interfaces/SeqState.md)

##### Returns

[`Json`](Json.md)

#### onFailure?

> `readonly` `optional` **onFailure?**: [`OnFailure`](OnFailure.md)

What a task that did not succeed does; absent means `"fail"`.

#### when?

> `readonly` `optional` **when?**: (`state`) => `boolean`

Gate evaluated on phase entry; absent means always run.

##### Parameters

###### state

[`SeqState`](../interfaces/SeqState.md)

##### Returns

`boolean`

***

### Type Literal

{ `activity`: [`ErasedActivity`](ErasedActivity.md); `concurrency`: `number`; `key`: `string`; `kind`: `"fan_out"`; `onFailure?`: [`OnFailure`](OnFailure.md); `select`: (`state`) => [`Json`](Json.md)\[]; }

#### activity

> `readonly` **activity**: [`ErasedActivity`](ErasedActivity.md)

The activity to run per item.

#### concurrency

> `readonly` **concurrency**: `number`

Maximum tasks in flight at once.

#### key

> `readonly` **key**: `string`

Key in `results`: the activity name.

#### kind

> `readonly` **kind**: `"fan_out"`

One task per selected item.

#### onFailure?

> `readonly` `optional` **onFailure?**: [`OnFailure`](OnFailure.md)

What a task that did not succeed does; absent means `"fail"`.

#### select

> `readonly` **select**: (`state`) => [`Json`](Json.md)\[]

Pure selector of the items; re-evaluated on every event of the phase.

##### Parameters

###### state

[`SeqState`](../interfaces/SeqState.md)

##### Returns

[`Json`](Json.md)\[]

***

### Type Literal

{ `concurrency`: `number`; `key`: `string`; `kind`: `"fan_out_runs"`; `onFailure?`: [`OnFailure`](OnFailure.md); `select`: (`state`) => [`Json`](Json.md)\[]; `workflow`: `string`; }

#### concurrency

> `readonly` **concurrency**: `number`

Maximum child runs in flight at once.

#### key

> `readonly` **key**: `string`

Key in `results`: the workflow name.

#### kind

> `readonly` **kind**: `"fan_out_runs"`

One child run per selected item.

#### onFailure?

> `readonly` `optional` **onFailure?**: [`OnFailure`](OnFailure.md)

What a child that did not complete does; absent means `"fail"`.

#### select

> `readonly` **select**: (`state`) => [`Json`](Json.md)\[]

Pure selector of the child inputs; re-evaluated on every event of the phase.

##### Parameters

###### state

[`SeqState`](../interfaces/SeqState.md)

##### Returns

[`Json`](Json.md)\[]

#### workflow

> `readonly` **workflow**: `string`

The workflow to spawn per item.

***

### Type Literal

{ `context?`: [`Json`](Json.md); `key`: `string`; `kind`: `"wait_for"`; `onTimeout?`: [`OnTimeout`](OnTimeout.md); `signal`: [`SignalDef`](../interfaces/SignalDef.md)<[`Json`](Json.md)>; `timeoutMs?`: `number`; }

#### context?

> `readonly` `optional` **context?**: [`Json`](Json.md)

Emitted on the `human` channel when the wait opens.

#### key

> `readonly` **key**: `string`

Key in `signals`: the signal name.

#### kind

> `readonly` **kind**: `"wait_for"`

A parked wait for a signal.

#### onTimeout?

> `readonly` `optional` **onTimeout?**: [`OnTimeout`](OnTimeout.md)

What the deadline does; absent means `"fail"`.

#### signal

> `readonly` **signal**: [`SignalDef`](../interfaces/SignalDef.md)<[`Json`](Json.md)>

The signal to wait for.

#### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

Deadline in milliseconds; absent means wait forever.

***

### Type Literal

{ `kind`: `"sleep"`; `ms`: `number`; }

#### kind

> `readonly` **kind**: `"sleep"`

A timer that stores nothing.

#### ms

> `readonly` **ms**: `number`

Duration in milliseconds.
