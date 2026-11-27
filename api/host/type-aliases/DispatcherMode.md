---
url: /vlo/api/host/type-aliases/DispatcherMode.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / DispatcherMode

# Type Alias: DispatcherMode

> **DispatcherMode** = `"loop"` | `"manual"`

Defined in: [sdk/ts/sdk/src/host/dispatcher.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/dispatcher.ts#L58)

`loop` ticks on an interval and on every `kick()`. `manual` never does either: the
process it runs in has no long-lived timer to hang a tick on, so something outside —
a cron hitting `POST /v1/timers/tick` — decides when the outbox moves.

`kick()` stays a no-op in `manual` mode on purpose. A kick is unattended and unbounded:
inside a serverless request it would start work the platform is free to freeze the moment
the response is sent, leaving tasks marked `running` with nobody behind them. `Host.drain`
(or `POST /v1/timers/tick?drain=1`) is the explicit, awaited, time-boxed form of the same
thing — the caller stays alive for it and knows when it stopped.
