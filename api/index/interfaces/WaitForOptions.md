---
url: /vlo/api/index/interfaces/WaitForOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / WaitForOptions

# Interface: WaitForOptions

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:167](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L167)

Deadline and presentation options for [waitFor](../functions/waitFor.md).

## Properties

### context?

> `optional` **context?**: [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:173](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L173)

Emitted on the `human` channel alongside the wait, for whatever renders the ask.

***

### onTimeout?

> `optional` **onTimeout?**: [`OnTimeout`](../type-aliases/OnTimeout.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:171](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L171)

`"fail"` (default) fails the run at the deadline; `"continue"` advances with a `null` payload.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:169](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L169)

Deadline in milliseconds, counted from when the wait opens. Absent: the run waits forever.
