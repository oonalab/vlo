---
url: /vlo/api/host/classes/GcsBlobStore.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / GcsBlobStore

# Class: GcsBlobStore

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L54)

The Google Cloud Storage [BlobStore](../interfaces/BlobStore.md). Opened by `openBlobStore("gcs://…")`. Needs
the optional peer dependency `@google-cloud/storage` unless a `client` is injected.

## Implements

* [`BlobStore`](../interfaces/BlobStore.md)

## Constructors

### Constructor

> **new GcsBlobStore**(`options`): `GcsBlobStore`

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L61)

Throws a plain `Error` when `bucket` is empty. No network call is made here.

#### Parameters

##### options

[`GcsBlobStoreOptions`](../interfaces/GcsBlobStoreOptions.md)

#### Returns

`GcsBlobStore`

## Methods

### get()

> **get**(`sha256Hex`): `Promise`<`Uint8Array`<`ArrayBufferLike`>>

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L81)

Downloads the blob; rejects with the client's error when it is missing.

#### Parameters

##### sha256Hex

`string`

#### Returns

`Promise`<`Uint8Array`<`ArrayBufferLike`>>

#### Implementation of

[`BlobStore`](../interfaces/BlobStore.md).[`get`](../interfaces/BlobStore.md#get)

***

### put()

> **put**(`bytes`): `Promise`<`string`>

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:72](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L72)

Uploads unless an object with that digest already exists; returns the sha256 hex digest.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`Promise`<`string`>

#### Implementation of

[`BlobStore`](../interfaces/BlobStore.md).[`put`](../interfaces/BlobStore.md#put)
