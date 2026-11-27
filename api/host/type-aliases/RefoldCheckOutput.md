---
url: /vlo/api/host/type-aliases/RefoldCheckOutput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / RefoldCheckOutput

# Type Alias: RefoldCheckOutput

> **RefoldCheckOutput** = { `actual?`: `undefined`; `expected?`: `undefined`; `matches`: `true`; `seq?`: `undefined`; } | { `actual`: `string`; `expected`: `string`; `matches`: `false`; `seq`: `number`; }

Defined in: [sdk/ts/sdk/src/kernel/kernel-api.ts:128](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/kernel-api.ts#L128)

Output of `refoldCheck`.

## Union Members

### Type Literal

{ `actual?`: `undefined`; `expected?`: `undefined`; `matches`: `true`; `seq?`: `undefined`; }

#### actual?

> `optional` **actual?**: `undefined`

Never set.

#### expected?

> `optional` **expected?**: `undefined`

Never set.

#### matches

> **matches**: `true`

Every hash matched.

#### seq?

> `optional` **seq?**: `undefined`

Never set.

***

### Type Literal

{ `actual`: `string`; `expected`: `string`; `matches`: `false`; `seq`: `number`; }

#### actual

> **actual**: `string`

The re-folded hash.

#### expected

> **expected**: `string`

The journaled hash.

#### matches

> **matches**: `false`

A hash diverged.

#### seq

> **seq**: `number`

First divergent sequence number.
