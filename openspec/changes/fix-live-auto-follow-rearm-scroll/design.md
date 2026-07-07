## Context

`Messages` 现在有两层 auto-follow 状态：

- `liveAutoFollowEnabled`: persisted preference，由 Composer 工具条按钮和 `localStorage` 控制。
- `autoScrollRef.current`: 当前幕布的临时 scroll lock，用户滚离底部后会变成 `false`，用于保护历史阅读。

问题出在这两层状态没有重新汇合：按钮重新开启时只同步 preference，没有显式恢复当前幕布的 scroll lock，也没有立即滚到底部。

## Goals / Non-Goals

**Goals:**

- 重新开启焦点跟随时，当前 `Messages` viewport 立即回到底部 sentinel。
- 后续 live output 继续使用现有 auto-follow path。
- 保留用户手动上滚后的暂停保护。

**Non-Goals:**

- 不重做 message timeline virtualization / scroll ownership。
- 不改变 anchor rail bottom jump 的实现。
- 不新增 cross-window storage contract 或 backend setting。

## Decisions

### Decision 1: `Messages` owns re-arm behavior

当 `MESSAGES_LIVE_CONTROLS_UPDATED_EVENT` 的 detail 包含 `liveAutoFollowEnabled: true` 时，`Messages` 同步执行：

1. `setLiveAutoFollowEnabled(true)`
2. `autoScrollRef.current = true`
3. bottom sentinel `scrollIntoView({ behavior: "instant", block: "end" })`

Alternative considered: 让 `ContextBar` 发一个新的 `scrollToBottom` event。拒绝原因：`ContextBar` 不拥有消息 DOM，也不应该知道 bottom sentinel 细节；新增 event contract 对这个局部修复过重。

### Decision 2: one-shot imperative scroll, not continuous override

重新开启焦点跟随只触发一次 immediate scroll。后续是否持续跟随仍交给现有 `scrollKey` / live row / `requestAutoScroll` path。

Alternative considered: 删除 `autoScrollRef` guard，让 preference enabled 时始终滚底。拒绝原因：这会破坏用户上滚阅读历史时暂停跟随的 UX。

## Risks / Trade-offs

- [Risk] 用户误点开启后视口会立即跳到底部。→ Mitigation: 这正是“开启焦点跟随到最新输出”的语义，且关闭按钮仍可停止后续跟随。
- [Risk] `scrollIntoView` 在 streaming 期间使用 smooth animation 会增加输入卡顿。→ Mitigation: re-arm 使用 `instant`，与 streaming auto-follow 的性能取向一致。
- [Risk] 事件到达时 bottom sentinel 尚未挂载。→ Mitigation: 使用 optional guard；下一次 `scrollKey` 或 live row auto-scroll 仍会接管。

## Migration Plan

1. 修改 `Messages` 的 live controls event handler。
2. 增加 focused Vitest 覆盖 re-arm scroll。
3. 运行 `openspec validate` 和相关 Messages 测试。

Rollback: revert `Messages.tsx` handler change and the focused test; storage key 与 UI surface 无 schema 迁移。

## Open Questions

- 无。
