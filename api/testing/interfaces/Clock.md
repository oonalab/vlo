---
url: /vlo/api/testing/interfaces/Clock.md
---
[@oona/vlo](../../packages.md) / [testing](../index.md) / Clock

# Interface: Clock

Defined in: [sdk/ts/sdk/src/journal/fixtures.ts:11](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/fixtures.ts#L11)

A clock a test moves by hand; `now` is what a host built with `now: clock.now` sees.

## Methods

### advance()

> **advance**(`ms`): `void`

Defined in: [sdk/ts/sdk/src/journal/fixtures.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/fixtures.ts#L15)

Moves the clock forward by `ms` milliseconds. Never runs backwards.

#### Parameters

##### ms

`number`

#### Returns

`void`

***

### now()

> **now**(): `number`

Defined in: [sdk/ts/sdk/src/journal/fixtures.ts:13](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/fixtures.ts#L13)

Current time as epoch milliseconds.

#### Returns

`number`
