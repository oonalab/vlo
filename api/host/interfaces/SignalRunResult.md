---
url: /vlo/api/host/interfaces/SignalRunResult.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalRunResult

# Interface: SignalRunResult

Defined in: [sdk/ts/sdk/src/host/runs.ts:95](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L95)

What [signalRun](../functions/signalRun.md) returns.

## Properties

### delivered

> **delivered**: `boolean`

Defined in: [sdk/ts/sdk/src/host/runs.ts:105](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L105)

True when an open wait folded the signal into the run. False in two cases: nothing was
waiting, so the signal is buffered until a wait with that name opens; or the wait it
matched had already closed — its timeout fired first, or the run has ended — a late
signal. A late signal is recorded against the closed step, never folded, never buffered,
and the stale wait row is dropped.

***

### signal_id

> **signal_id**: `string`

Defined in: [sdk/ts/sdk/src/host/runs.ts:97](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/runs.ts#L97)

The stored signal's id, `sig_<32 hex>`.
