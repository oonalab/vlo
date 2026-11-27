---
url: /vlo/api/host/interfaces/Registries.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Registries

# Interface: Registries

Defined in: [sdk/ts/sdk/src/host/domain.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L43)

The four registries a host is built from, flattened.

## Properties

### activities

> **activities**: readonly [`ActivityRegistration`](ActivityRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L49)

Every activity registration.

***

### signals

> **signals**: readonly [`SignalRegistration`](SignalRegistration.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L51)

Every signal registration.

***

### workers

> **workers**: readonly [`Worker`](../../index/interfaces/Worker.md)\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L47)

Every worker.

***

### workflows

> **workflows**: readonly [`Workflow`](../../index/interfaces/Workflow.md)<`unknown`, `unknown`>\[]

Defined in: [sdk/ts/sdk/src/host/domain.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L45)

Every workflow, across domains and the flat option.
