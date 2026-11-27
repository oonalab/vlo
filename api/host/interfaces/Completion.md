---
url: /vlo/api/host/interfaces/Completion.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Completion

# Interface: Completion

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:113](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L113)

The run's terminal outcome, present when the event closed the run.

## Properties

### output?

> `optional` **output?**: [`Json`](../../index/type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:117](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L117)

Output, when the run completed.

***

### status

> **status**: [`RunStatus`](../../index/type-aliases/RunStatus.md)

Defined in: [sdk/ts/sdk/src/kernel/transition.ts:115](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/transition.ts#L115)

Terminal status.
