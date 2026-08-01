## Why

messages row/presentation 当前直接解析 browser-agent、intent-canvas、project-memory、note-cards 的 injected prompt 与
producer-specific attachment。realtime assembly 与 history loader 对同一上下文的表达不完全一致，renderer 因此既承担
展示策略，又承担 transport compatibility parsing，导致 producer 变更会穿透到 messages 私有实现。

## What Changes

- 在 `src/types/conversation.ts` 定义 neutral `ConversationPresentationContext` 与
  `MessagePresentationMetadata`，并作为 message item 的 optional normalized contract。
- 在 realtime assembly 与各 history loader boundary 生成一致的 display text、sticky candidate 与 context metadata。
- 保留 raw text/attachment 字段用于 migration 与旧历史兼容，不在本阶段删除 transport data。
- messages row/presentation 优先消费 `presentationMetadata`；legacy raw prompt parsing 仅保留在一个 fallback adapter。
- 删除 row/presentation 对 browser-agent、intent-canvas、project-memory、note-cards parser 的 direct imports。

## 验收标准

- realtime/history 对 memory-only、note-card、browser、intent-canvas、image-only 与 legacy injected text 的展示结果一致。
- `MessagePresentationMetadata` 是 producer-neutral contract，messages row/presentation 不理解 raw injected prompt grammar。
- messages row/presentation 对四个 producer feature 的 direct import 为 0。
- legacy history 未携带 metadata 时仍通过单一 fallback adapter 保持当前显示。
- focused parity、history loader、messages rich-content/note-card/conversation-state、runtime contract 与 typecheck 全部通过。
