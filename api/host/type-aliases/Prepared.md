---
url: /vlo/api/host/type-aliases/Prepared.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Prepared

# Type Alias: Prepared

> **Prepared** = { `init_input?`: [`Json`](../../index/type-aliases/Json.md); `kernel_state`: [`KernelState`](../interfaces/KernelState.md); `mode`: `"reduce"`; `reducer_event`: [`ReducerEvent`](../../index/type-aliases/ReducerEvent.md); } | { `mode`: `"lifecycle"`; `transition`: [`Transition`](../interfaces/Transition.md); }

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L58)

Output of `prepareEvent`: either call the reducer, or apply a lifecycle transition as is.

## Union Members

### Type Literal

{ `init_input?`: [`Json`](../../index/type-aliases/Json.md); `kernel_state`: [`KernelState`](../interfaces/KernelState.md); `mode`: `"reduce"`; `reducer_event`: [`ReducerEvent`](../../index/type-aliases/ReducerEvent.md); }

#### init_input?

> `optional` **init_input?**: [`Json`](../../index/type-aliases/Json.md)

The workflow input, on `started`.

#### kernel_state

> **kernel_state**: [`KernelState`](../interfaces/KernelState.md)

Kernel state to reduce against.

#### mode

> **mode**: `"reduce"`

The reducer must run.

#### reducer_event

> **reducer_event**: [`ReducerEvent`](../../index/type-aliases/ReducerEvent.md)

The event in reducer form.

***

### Type Literal

{ `mode`: `"lifecycle"`; `transition`: [`Transition`](../interfaces/Transition.md); }

#### mode

> **mode**: `"lifecycle"`

No reducer call: the transition is complete.

#### transition

> **transition**: [`Transition`](../interfaces/Transition.md)

The write-set to apply.
