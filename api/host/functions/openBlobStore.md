---
url: /vlo/api/host/functions/openBlobStore.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / openBlobStore

# Function: openBlobStore()

> **openBlobStore**(`url`): [`BlobStore`](../interfaces/BlobStore.md)

Defined in: [sdk/ts/sdk/src/blob/open.ts:15](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/open.ts#L15)

Opens a blob store by URL: `file://<dir>` (relative to the working directory when the
path is) or `gcs://<bucket>/<prefix>`. The GCS client is only loaded on first use.
Throws a plain `Error` on any other scheme or an empty directory or bucket.

## Parameters

### url

`string`

## Returns

[`BlobStore`](../interfaces/BlobStore.md)
