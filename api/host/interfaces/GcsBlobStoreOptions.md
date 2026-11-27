---
url: /vlo/api/host/interfaces/GcsBlobStoreOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / GcsBlobStoreOptions

# Interface: GcsBlobStoreOptions

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L39)

Where a [GcsBlobStore](../classes/GcsBlobStore.md) writes.

## Properties

### bucket

> **bucket**: `string`

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L41)

Bucket name. Required.

***

### client?

> `optional` **client?**: [`GcsClientLike`](GcsClientLike.md)

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L47)

Injected client. Absent ⇒ `@google-cloud/storage` with ADC.

***

### prefix?

> `optional` **prefix?**: `string`

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L43)

Key prefix inside the bucket, e.g. `vlo/blobs`.

***

### projectId?

> `optional` **projectId?**: `string`

Defined in: [sdk/ts/sdk/src/blob/gcs.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/blob/gcs.ts#L45)

GCP project for the default client. Absent ⇒ the credentials' project.
