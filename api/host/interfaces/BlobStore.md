---
url: /vlo/api/host/interfaces/BlobStore.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / BlobStore

# Interface: BlobStore

Defined in: [sdk/ts/sdk/src/blob/types.ts:5](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/types.ts#L5)

Content-addressed storage for anything too big to inline in the journal
(payloads and checkpoints over 256 KB).

## Methods

### get()

> **get**(`sha256Hex`): `Promise`<`Uint8Array`<`ArrayBufferLike`>>

Defined in: [sdk/ts/sdk/src/blob/types.ts:9](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/types.ts#L9)

The bytes stored under that digest. Rejects when there are none.

#### Parameters

##### sha256Hex

`string`

#### Returns

`Promise`<`Uint8Array`<`ArrayBufferLike`>>

***

### put()

> **put**(`bytes`): `Promise`<`string`>

Defined in: [sdk/ts/sdk/src/blob/types.ts:7](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/types.ts#L7)

Stores the bytes and returns their sha256, lowercase hex. Idempotent.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`Promise`<`string`>
