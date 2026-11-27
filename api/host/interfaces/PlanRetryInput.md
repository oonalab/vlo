---
url: /vlo/api/host/interfaces/PlanRetryInput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PlanRetryInput

# Interface: PlanRetryInput

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L89)

Input of `planRetry`.

## Properties

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L93)

The attempt that just failed.

***

### cause

> **cause**: [`Cause`](../../index/type-aliases/Cause.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L95)

Why it failed.

***

### policy

> **policy**: [`RetryPolicy`](../../index/interfaces/RetryPolicy.md)

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:91](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L91)

The activity's retry policy.

***

### random

> **random**: `string`

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L97)

Journaled randomness for jitter, as a hex string, so a re-fold plans the same delay.
