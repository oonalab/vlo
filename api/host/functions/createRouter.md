---
url: /vlo/api/host/functions/createRouter.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / createRouter

# Function: createRouter()

> **createRouter**(`ctx`): [`FetchHandler`](../type-aliases/FetchHandler.md)

Defined in: [sdk/ts/sdk/src/host/api/router.ts:50](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/api/router.ts#L50)

Builds the `/v1` router for a context. Every [VloError](../classes/VloError.md) becomes a JSON error response
with its status; anything else is a 500. Routes a role is not held for answer 404
`role_not_served`. `createHost` calls this; only custom hosts need it directly.

## Parameters

### ctx

[`HostContext`](../interfaces/HostContext.md)

## Returns

[`FetchHandler`](../type-aliases/FetchHandler.md)
