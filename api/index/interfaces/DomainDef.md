---
url: /vlo/api/index/interfaces/DomainDef.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / DomainDef

# Interface: DomainDef

Defined in: [sdk/ts/sdk/src/host/domain.ts:13](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L13)

What [defineDomain](../functions/defineDomain.md) takes. Every registry is optional.

## Properties

### activities?

> `optional` **activities?**: readonly [`ActivityRegistration`](../../host/interfaces/ActivityRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L21)

Activities whose output the host validates.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/host/domain.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L15)

Name for diagnostics; two domains with the same name are refused.

***

### signals?

> `optional` **signals?**: readonly [`SignalRegistration`](../../host/interfaces/SignalRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L23)

Signals whose payload the host validates.

***

### workers?

> `optional` **workers?**: readonly [`Worker`](Worker.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L19)

Workers run in-process for this domain. Each adds a `worker:<queue>` role when `roles` is absent.

***

### workflows?

> `optional` **workflows?**: readonly [`Workflow`](Workflow.md)<`unknown`, `unknown`>\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L17)

Workflows this domain owns.
