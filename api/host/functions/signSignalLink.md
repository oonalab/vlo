---
url: /vlo/api/host/functions/signSignalLink.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / signSignalLink

# Function: signSignalLink()

> **signSignalLink**(`secret`, `link`): `string`

Defined in: [sdk/ts/sdk/src/host/links.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L53)

Mints the token for a link: `v1.<expiresAtMs>.<hmac-sha256 hex>`. The host's
`POST /v1/runs/{id}/links/{name}` route does this for you; call it directly to mint
links out of band with the same secret ([linkSecret](linkSecret.md)).

## Parameters

### secret

`string`

### link

[`SignalLinkClaims`](../interfaces/SignalLinkClaims.md)

## Returns

`string`

## Example

```ts
const token = signSignalLink(secret, {
  runId: "run_1",
  name: "approve",
  expiresAtMs: Date.now() + DEFAULT_LINK_TTL_MS,
});
verifySignalLink(secret, token, "run_1", "approve", Date.now()); // true
```
