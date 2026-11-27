---
url: /vlo/api/index/variables/DEFAULT_RETRY.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / DEFAULT_RETRY

# Variable: DEFAULT_RETRY

> `const` **DEFAULT_RETRY**: [`RetryPolicy`](../interfaces/RetryPolicy.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L17)

Retry policy an activity gets when [ActivityOptions.retry](../interfaces/ActivityOptions.md#retry) is omitted: three
attempts, exponential backoff from 1 s to a 10 min cap, factor 2, full jitter. Each
field is also the fallback for any [RetryOptions](../interfaces/RetryOptions.md) field left unset.
