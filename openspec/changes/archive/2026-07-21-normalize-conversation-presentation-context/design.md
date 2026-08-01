## Decisions

### Normalize at ingestion boundaries

`conversationNormalization.ts` 提供 pure normalization helper，realtime assembler 与 history loaders 在 message item
进入 conversation state 前调用。renderer 不再自行拼装 producer-specific context。

### Keep raw transport fields during migration

`text`、`browserContextAttachment`、`intentCanvasContextAttachments` 与 legacy injected prompt 继续保留。新增
`presentationMetadata` 是 additive contract，避免破坏 persisted history、reconciliation 与 producer send pipeline。

### Use one fallback adapter

messages 只允许一个 legacy adapter 从 raw item 构建 `MessagePresentationMetadata`。正常路径直接读取 metadata；fallback
只服务于尚未迁移的历史 payload，禁止各 row/card 重复 import producer parser。

### Store neutral context view data

context union 只包含 renderer 所需字段：browser title/summary/evidence count、intent canvas title/summary、memory records/raw
payload、note-card title/summary/image paths。producer-specific raw schema 不进入 row presentation contract。

## Data Flow

```text
realtime event / history payload
  -> producer-aware boundary parser
  -> normalizeMessagePresentationMetadata
  -> ConversationItem.presentationMetadata
  -> messageRowPresentation / context cards

legacy ConversationItem without metadata
  -> one messages legacy adapter
  -> MessagePresentationMetadata
  -> same presentation path
```

## Risks / Mitigations

- metadata 与 raw text 漂移：parity fixtures 同时走 realtime/history，断言完整 model equality。
- suppression 回归：覆盖 memory-only、note-card-only、browser/intent injected prompt 与 image-only user message。
- history format 不完整：metadata optional，fallback adapter 保留直到 supported history 全覆盖。
- contract 过度携带 producer schema：shared union 只存 neutral view fields，raw payload 仅 memory compatibility 可选保留。
- hot path 成本增加：normalization 在 ingestion/history boundary 执行，row render 不重复 parse raw prompt。
