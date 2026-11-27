---
url: /vlo/api/host/functions/drainHost.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / drainHost

# Function: drainHost()

> **drainHost**(`ctx`, `options?`): `Promise`<[`DrainResult`](../interfaces/DrainResult.md)>

Defined in: [sdk/ts/sdk/src/host/drain.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/drain.ts#L52)

Ticks until a pass is quiet or the budget runs out. `Host.drain` wraps this and additionally
shares one drain between concurrent callers; call that unless you hold a `HostContext`.
Throws a plain `Error` on a context without the `orchestrator` role.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

### options?

[`DrainOptions`](../interfaces/DrainOptions.md) = `{}`

## Returns

`Promise`<[`DrainResult`](../interfaces/DrainResult.md)>

## Example

```ts
// Inside a request on a `manual`-mode host: carry the run as far as it goes right now.
const result = await host.drain({ maxMs: 20_000 });
if (!result.idle) console.warn(`still busy after ${result.passes} passes`);
```
