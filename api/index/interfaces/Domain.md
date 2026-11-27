---
url: /vlo/api/index/interfaces/Domain.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Domain

# Interface: Domain

Defined in: [sdk/ts/sdk/src/host/domain.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L27)

A defined domain: the value [defineDomain](../functions/defineDomain.md) returns and `createHost({ domains })` flattens.

## Properties

### activities

> `readonly` **activities**: readonly [`ActivityRegistration`](../../host/interfaces/ActivityRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L37)

Activities whose output the host validates.

***

### kind

> `readonly` **kind**: `"domain"`

Defined in: [sdk/ts/sdk/src/host/domain.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L29)

Discriminator, like `Worker.kind`.

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/host/domain.ts:31](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L31)

The domain's name.

***

### signals

> `readonly` **signals**: readonly [`SignalRegistration`](../../host/interfaces/SignalRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L39)

Signals whose payload the host validates.

***

### workers

> `readonly` **workers**: readonly [`Worker`](Worker.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L35)

Workers run in-process for this domain.

***

### workflows

> `readonly` **workflows**: readonly [`Workflow`](Workflow.md)<`unknown`, `unknown`>\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L33)

Workflows this domain owns.
