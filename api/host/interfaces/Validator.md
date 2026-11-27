---
url: /vlo/api/host/interfaces/Validator.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Validator

# Interface: Validator

Defined in: [sdk/ts/sdk/src/host/context.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L22)

The parts of a Zod schema the host actually uses. Structural, so `Activity` and
`SignalDef` satisfy it without the host importing zod — and without fighting the
invariance of `z.ZodType` when the registry erases the schema's type.

## Methods

### safeParse()

> **safeParse**(`value`): { `data`: `unknown`; `success`: `true`; } | { `error`: { `issues`: readonly `object`\[]; `message`: `string`; }; `success`: `false`; }

Defined in: [sdk/ts/sdk/src/host/context.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L24)

Zod's `safeParse` shape: never throws, reports issues on failure.

#### Parameters

##### value

`unknown`

#### Returns

{ `data`: `unknown`; `success`: `true`; } | { `error`: { `issues`: readonly `object`\[]; `message`: `string`; }; `success`: `false`; }
