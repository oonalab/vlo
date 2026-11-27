---
url: /vlo/api/host/interfaces/GcsFileLike.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / GcsFileLike

# Interface: GcsFileLike

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:17](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L17)

The slice of `@google-cloud/storage` used here, so a fake client needs nothing more.

## Methods

### download()

> **download**(): `Promise`<\[`Uint8Array`<`ArrayBufferLike`>]>

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:23](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L23)

Downloads the object's bytes.

#### Returns

`Promise`<\[`Uint8Array`<`ArrayBufferLike`>]>

***

### exists()

> **exists**(): `Promise`<\[`boolean`]>

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:19](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L19)

`[true]` when the object exists.

#### Returns

`Promise`<\[`boolean`]>

***

### save()

> **save**(`data`, `options?`): `Promise`<`unknown`>

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:21](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L21)

Uploads the bytes. The store passes `resumable: false` and an octet-stream content type.

#### Parameters

##### data

`Uint8Array`

##### options?

###### contentType?

`string`

###### resumable?

`boolean`

#### Returns

`Promise`<`unknown`>
