---
url: /vlo/api/testing/functions/fakeClock.md
---
[@oona/vlo](../../packages.md) / [testing](../index.md) / fakeClock

# Function: fakeClock()

> **fakeClock**(`startMs`): [`Clock`](../interfaces/Clock.md)

Defined in: [sdk/ts/sdk/src/journal/fixtures.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/fixtures.ts#L37)

A [Clock](../interfaces/Clock.md) that starts at `startMs` and only moves when `advance` is called, so
leases, timers and timeouts expire exactly when a test says so.

## Parameters

### startMs

`number`

## Returns

[`Clock`](../interfaces/Clock.md)

## Example

```ts
import { fakeClock } from "@oona/vlo/testing";

const clock = fakeClock(1_700_000_000_000);
const host = createHost({
  journal: "sqlite://:memory:",
  workflows: [workflow],
  now: clock.now,
  dispatcher: { tickMs: 10 },
});
await host.start();
clock.advance(60_001); // one whole default lease and a millisecond
```
