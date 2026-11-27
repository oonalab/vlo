---
url: /vlo/api/index/interfaces/RetryPolicy.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / RetryPolicy

# Interface: RetryPolicy

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:116](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L116)

Wire form of a retry policy; the authoring form is `RetryOptions`. The delay before
attempt `n + 1` is `initial_ms` (fixed) or `initial_ms · factor^(n − 1)` (exponential),
capped at `max_ms`, then jittered. Retrying stops at `max_attempts` or on a cause that
never retries.

## Properties

### backoff

> **backoff**: [`Backoff`](../type-aliases/Backoff.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:120](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L120)

Delay growth strategy.

***

### factor

> **factor**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:126](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L126)

Growth multiplier for exponential backoff; ≤ 1 behaves like fixed.

***

### initial_ms

> **initial_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:122](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L122)

Delay before the second attempt, in milliseconds.

***

### jitter

> **jitter**: [`Jitter`](../type-aliases/Jitter.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:128](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L128)

Jitter applied to every delay.

***

### max_attempts

> **max_attempts**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:118](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L118)

Attempts in total, the first one included.

***

### max_ms

> **max_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:124](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L124)

Ceiling on any single delay, in milliseconds.
