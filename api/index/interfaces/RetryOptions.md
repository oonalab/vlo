---
url: /vlo/api/index/interfaces/RetryOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / RetryOptions

# Interface: RetryOptions

Defined in: [sdk/ts/sdk/src/core/activity.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L39)

Authoring form of [RetryPolicy](RetryPolicy.md) (camelCase, all optional); the wire form is
snake_case. Every omitted field falls back to [DEFAULT_RETRY](../variables/DEFAULT_RETRY.md).

## Properties

### backoff?

> `optional` **backoff?**: [`Backoff`](../type-aliases/Backoff.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L43)

`"fixed"` waits `initialMs` every time; `"exponential"` multiplies it by `factor` per attempt. Default `"exponential"`.

***

### factor?

> `optional` **factor?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L49)

Growth multiplier for exponential backoff; a value ≤ 1 behaves like fixed. Default `2`.

***

### initialMs?

> `optional` **initialMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L45)

Delay before the second attempt, in milliseconds. Default `1_000`.

***

### jitter?

> `optional` **jitter?**: [`Jitter`](../type-aliases/Jitter.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L51)

`"full"` scales each delay by a journaled random fraction; `"none"` uses it as is. Default `"full"`.

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L41)

Attempts in total, the first one included. Default `3`.

***

### maxMs?

> `optional` **maxMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L47)

Ceiling on any single delay, in milliseconds. Default `600_000`.
