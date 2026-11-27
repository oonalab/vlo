---
url: /vlo/api/host/type-aliases/RetryPlan.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RetryPlan

# Type Alias: RetryPlan

> **RetryPlan** = { `delay_ms`: `number`; `next_attempt`: `number`; `retry`: `true`; } | { `delay_ms?`: `undefined`; `next_attempt?`: `undefined`; `retry`: `false`; }

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:101](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L101)

Output of `planRetry`.

## Union Members

### Type Literal

{ `delay_ms`: `number`; `next_attempt`: `number`; `retry`: `true`; }

#### delay_ms

> **delay_ms**: `number`

Delay before it, in milliseconds.

#### next_attempt

> **next_attempt**: `number`

The next attempt number.

#### retry

> **retry**: `true`

Retry after `delay_ms`.

***

### Type Literal

{ `delay_ms?`: `undefined`; `next_attempt?`: `undefined`; `retry`: `false`; }

#### delay_ms?

> `optional` **delay_ms?**: `undefined`

Never set.

#### next_attempt?

> `optional` **next_attempt?**: `undefined`

Never set.

#### retry

> **retry**: `false`

Give up.
