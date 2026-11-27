---
url: /vlo/api/index/variables/cmd.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / cmd

# Variable: cmd

> `const` **cmd**: `object`

Defined in: [sdk/ts/sdk/src/core/commands.ts:236](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L236)

The command constructors a reducer returns to the engine. Each builds a plain
[Command](../type-aliases/Command.md); nothing runs until the host applies the reduction. `task`, `timer`,
`spawn` and `awaitSignal` open a step, `emit` records a side effect, `complete` and
`continueAsNew` close the run and must come last.

## Type Declaration

### awaitHuman

> **awaitHuman**: <`T`>(`definition`, `options`) => [`Command`](../type-aliases/Command.md)\[]

`awaitSignal` with a deadline + `emit("human", …)`; returns a `Command[]`.

Ask a human. Sugar over `await_signal` (with its deadline) + `emit`: the wait reserves
`id` and the kernel opens `${id}:timeout` beside it, so whichever arrives first wins and
the kernel cancels the loser. Returns commands — spread it into a reduction.

#### Type Parameters

##### T

`T`

#### Parameters

##### definition

[`SignalDef`](../interfaces/SignalDef.md)<`T`>

##### options

[`AwaitHumanOptions`](../interfaces/AwaitHumanOptions.md)

#### Returns

[`Command`](../type-aliases/Command.md)\[]

### awaitSignal

> **awaitSignal**: <`T`>(`definition`, `options?`) => [`Command`](../type-aliases/Command.md)

Parks the run until the named signal is delivered.

Parks the run until a signal named after `definition` is delivered; the payload arrives
on a `signal` event. A signal that arrived before the wait was opened is buffered and
delivered immediately, oldest first. The run holds no compute while parked. With
`timeoutMs` the kernel also opens a timer step `<id>:timeout` and cancels whichever of
the two loses; see [signalTimeoutStepId](../functions/signalTimeoutStepId.md).

#### Type Parameters

##### T

`T`

#### Parameters

##### definition

[`SignalDef`](../interfaces/SignalDef.md)<`T`>

##### options?

[`AwaitSignalOptions`](../interfaces/AwaitSignalOptions.md)

#### Returns

[`Command`](../type-aliases/Command.md)

### complete

> **complete**: (`output`) => [`Command`](../type-aliases/Command.md)

Closes the run as `completed`. Must be last.

Closes the run as `completed` with `output`. It must be the last command of the reduction;
the kernel rejects any command after it.

#### Parameters

##### output

[`Json`](../type-aliases/Json.md)

#### Returns

[`Command`](../type-aliases/Command.md)

### continueAsNew

> **continueAsNew**: (`input`) => [`Command`](../type-aliases/Command.md)

Closes the run as `continued` with a fresh start input. Must be last.

Closes the run as `continued`, carrying `input` as the start input of a successor run. It
must be the last command of the reduction. The host starts the successor (same workflow,
this `input`) in the same transaction and links the two runs by `continued_from` and
`continued_to`; a parent run is notified once, by the run that finally closes.

#### Parameters

##### input

[`Json`](../type-aliases/Json.md)

#### Returns

[`Command`](../type-aliases/Command.md)

### emit

> **emit**: (`channel`, `data`) => [`Command`](../type-aliases/Command.md)

Publishes on a side channel; never journaled.

Publishes `data` on a side channel. Emits never enter the run's history and never come
back to the reducer; the host forwards them to event-stream subscribers, which is where
progress ticks and UI hints belong.

#### Parameters

##### channel

`string`

##### data

[`Json`](../type-aliases/Json.md)

#### Returns

[`Command`](../type-aliases/Command.md)

### spawn

> **spawn**: (`workflow`, `input`, `options?`) => [`Command`](../type-aliases/Command.md)

Starts a child run; its result arrives as `child_done`.

Starts a child run of `workflow` (a name, or anything with a `name` such as a
[Workflow](../interfaces/Workflow.md)) with `input`. The child's terminal status and output come back to this
run as a `child_done` event on the spawn's step id. The workflow must be registered on
the host that dispatches the command.

#### Parameters

##### workflow

`string` | { `name`: `string`; }

##### input

[`Json`](../type-aliases/Json.md)

##### options?

[`SpawnOptions`](../interfaces/SpawnOptions.md)

#### Returns

[`Command`](../type-aliases/Command.md)

### task

> **task**: <`I`, `O`>(`target`, `input`, `options?`) => [`Command`](../type-aliases/Command.md)

Runs an activity once, with retries. Throws [ActivityInputError](../classes/ActivityInputError.md) on bad input.

Requests one attempt-tracked execution of `target` with `input`.

`input` is parsed with the activity's Zod schema; the parsed value (defaults applied) is
what travels. The activity's `queue`, `retry`, `leaseMs` and `timeoutMs` are copied onto
the command; `options.queue` overrides the queue for this call.

#### Type Parameters

##### I

`I`

##### O

`O`

#### Parameters

##### target

[`Activity`](../interfaces/Activity.md)<`I`, `O`>

##### input

`I`

##### options?

[`TaskOptions`](../interfaces/TaskOptions.md)

#### Returns

[`Command`](../type-aliases/Command.md)

#### Throws

[ActivityInputError](../classes/ActivityInputError.md) when the input does not match the activity's schema.

### timer

> **timer**: (`options`) => [`Command`](../type-aliases/Command.md)

Fires a `timer` event after `ms` or at `atMs`.

Schedules a `timer` event for the run. `ms` is relative to the timestamp of the event
being reduced; `atMs` is absolute epoch milliseconds.

Throws a `TypeError` synchronously when neither or both of `ms` / `atMs` are given.

#### Parameters

##### options

[`TimerOptions`](../interfaces/TimerOptions.md)

#### Returns

[`Command`](../type-aliases/Command.md)

## Example

```ts
import { cmd, defineWorkflow } from "@oona/vlo";
import { approve, work } from "./activities.ts";

export default defineWorkflow("review", {
  init: (input: { item: string }) => ({ item: input.item, upper: null as string | null }),
  on: {
    started: (s) => [s, [cmd.task(work, { item: s.item })]],
    task_done: (s, e) => [
      { ...s, upper: (e.output as { upper: string }).upper },
      cmd.awaitHuman(approve, { id: "approval", timeoutMs: 86_400_000 }),
    ],
    signal: (s) => [s, [cmd.complete({ upper: s.upper })]],
    timer: (s) => [s, [cmd.complete(null)]],
  },
});
```
