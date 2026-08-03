---
type: reference
status: active
---

# Chat Canvas Conversation Curtain Contracts

> **内容类型**：Reference
> **生命周期**：active
> **实现事实源**：`src/features/threads/contracts/conversationCurtainContracts.ts`（以源码为准）。
> **现网结构 / 多引擎**：[`../../analysis/conversation-canvas-structure-2026-07-31.md`](../../analysis/conversation-canvas-structure-2026-07-31.md) · [`../../analysis/README.md`](../../analysis/README.md)
> **最后校准**：2026-08-03 · mossx `0.7.16`
> **更新触发器**：`ConversationEngine`、normalized item kind、event operation 或 history snapshot shape 变化
> **上级导航**：[`README.md`](README.md) · [`../README.md`](../README.md)

## Scope

This document defines the shared contracts used by the conversation curtain refactor:

- `NormalizedThreadEvent`
- `NormalizedHistorySnapshot`
- `ConversationState`
- `RealtimeAdapter`
- `HistoryLoader`
- `ConversationAssembler`

Implementation source: `src/features/threads/contracts/conversationCurtainContracts.ts`.

## Canonical Item Kinds

Only these `ConversationItem.kind` values are valid in the normalized pipeline:

- `message`
- `reasoning`
- `diff`
- `review`
- `explore`
- `generatedImage`
- `tool`

Renderer code should not introduce engine-specific kinds.

## Realtime Contract

Each realtime adapter maps engine-specific payloads into:

- `engine`: `codex | claude | gemini | grok | kimi | opencode`
- `workspaceId`
- `threadId`
- `eventId`
- `itemKind`
- `timestampMs`
- `item` (`ConversationItem`)
- `operation` (`itemStarted/itemUpdated/itemCompleted` 或各类 `append*`/`complete*` 增量操作)
- `sourceMethod`
- optional `delta` / `rawItem` / `rawUsage`
- optional `turnId`

Positive example:

```ts
const event = {
  engine: "codex",
  workspaceId: "ws-1",
  threadId: "thread-1",
  eventId: "evt-1",
  itemKind: "tool",
  timestampMs: Date.now(),
  sourceMethod: "item/started",
  item: {
    id: "tool-1",
    kind: "tool",
    toolType: "commandExecution",
    title: "Run command",
    detail: "npm run typecheck",
    status: "started",
  },
};
```

Negative example:

- Missing `threadId` or `eventId`.
- Emitting an engine-private kind like `heartbeat` as `item.kind`.

## History Contract and Fallback Strategy

`NormalizedHistorySnapshot` MUST include:

- `items` array
- `plan` (`TurnPlan | null`)
- `userInputQueue` array
- `meta`
- `fallbackWarnings`

Fallback behavior is explicit and visible:

- If `items` is missing: fallback to `[]` and append warning `missing_items`.
- If `plan` is missing: fallback to `null` and append warning `missing_plan`.
- If `userInputQueue` is missing: fallback to `[]` and append warning `missing_user_input_queue`.
- If `meta` is missing: generate default meta and append warning `missing_meta`.

No silent fallback is allowed.

## Assembler Contract

`ConversationAssembler` remains the single merge boundary:

- `appendEvent(state, event)` for realtime deltas.
- `hydrateHistory(snapshot)` for restore.

The rendering kernel should consume only `ConversationState` (`items`, `plan`, `userInputQueue`, `meta`).
