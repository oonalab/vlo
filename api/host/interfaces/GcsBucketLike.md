---
url: /vlo/api/host/interfaces/GcsBucketLike.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / GcsBucketLike

# Interface: GcsBucketLike

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L27)

The slice of a GCS bucket handle used here.

## Methods

### file()

> **file**(`name`): [`GcsFileLike`](GcsFileLike.md)

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:29](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L29)

A handle for the object at `name`.

#### Parameters

##### name

`string`

#### Returns

[`GcsFileLike`](GcsFileLike.md)
