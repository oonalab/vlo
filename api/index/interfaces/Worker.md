---
url: /vlo/api/index/interfaces/Worker.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Worker

# Interface: Worker

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L54)

A defined worker: the value [defineWorker](../functions/defineWorker.md) returns and the host or config loader registers.

## Properties

### handlers

> `readonly` **handlers**: `ReadonlyMap`<`string`, [`ActivityHandler`](../type-aliases/ActivityHandler.md)<[`Json`](../type-aliases/Json.md), `unknown`>>

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L60)

Handlers by activity name.

***

### kind

> `readonly` **kind**: `"worker"`

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L56)

Discriminator the config loader uses to find workers among a module's exports.

***

### queues

> `readonly` **queues**: readonly `string`\[]

Defined in: [sdk/ts/sdk/src/host/worker/registry.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/registry.ts#L58)

Queues this worker serves.
