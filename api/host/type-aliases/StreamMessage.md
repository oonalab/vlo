---
url: /vlo/api/host/type-aliases/StreamMessage.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / StreamMessage

# Type Alias: StreamMessage

> **StreamMessage** = { `data`: [`Envelope`](../interfaces/Envelope.md); `seq`: `number`; `type`: `"journal"`; } | { `data`: { `channel`: `string`; `data`: [`Json`](../../index/type-aliases/Json.md); }; `type`: `"emit"`; } | { `data`: [`RunView`](../interfaces/RunView.md); `type`: `"end"`; }

Defined in: [sdk/ts/sdk/src/client/index.ts:91](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/client/index.ts#L91)

One SSE frame, already decoded. `end` is the last one a stream sends.
