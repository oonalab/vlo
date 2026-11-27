---
url: /vlo/api/host/interfaces/StreamOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StreamOptions

# Interface: StreamOptions

Defined in: [sdk/ts/sdk/src/client/index.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L83)

Options for `Client.stream`.

## Properties

### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [sdk/ts/sdk/src/client/index.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L87)

Closes the stream when aborted.

***

### since?

> `optional` **since?**: `number`

Defined in: [sdk/ts/sdk/src/client/index.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L85)

Replay journal events after this seq. Default 0: from the beginning.
