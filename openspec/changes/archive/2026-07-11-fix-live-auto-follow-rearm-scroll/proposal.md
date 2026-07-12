## Why

消息幕布的“焦点跟随”按钮只反映 persisted preference，但真实 auto-follow 还受 `autoScrollRef` 隐藏锁控制。用户在当前幕布滚离底部后，即使按钮保持选中或重新选中，当前 streaming surface 也可能不再自动回到底部。

这个问题需要现在修复，因为它让“焦点跟随”的 UI 状态与行为语义分裂：selected 看起来已启用，但最新输出仍停在视口外。

## 目标与边界

- 目标：当用户在运行中的消息幕布重新开启焦点跟随时，立即 re-arm 当前幕布的 auto-follow lock，并滚动到底部 sentinel。
- 目标：保留手动上滚后暂停跟随的保护，避免 streaming 每个 token 都强制抢回视口。
- 边界：只修改 frontend message canvas / composer live control event，不触碰 backend、runtime lifecycle、message order 或 streaming batching。

## 非目标

- 不改变右侧 anchor rail 的“直达底部”按钮能力；该能力由 `add-message-anchor-bottom-jump` 覆盖。
- 不新增新的 scroll preference、global state framework 或 backend setting。
- 不改变静态 history append 时不触发 live auto-follow 的既有保护。

## What Changes

- `Messages` 在收到 `liveAutoFollowEnabled: true` 的 live controls event 时，显式设置 `autoScrollRef.current = true`。
- 同一事件触发一次当前幕布 bottom sentinel scroll，确保用户重新选中焦点跟随后立即回到底部。
- 保留 `liveAutoFollowEnabled=false` 时停止跟随、手动滚离底部时暂停跟随、静态 history 更新不自动滚动的既有行为。
- 增加 focused Vitest 覆盖：先让用户滚离底部，再通过 live controls event 重新开启焦点跟随，断言立即滚到底部。

## 技术方案取舍

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 在 `Messages` 处理 live controls event 时 re-arm + scroll | 事件携带 `liveAutoFollowEnabled: true` 时直接恢复 `autoScrollRef` 并 scroll bottom | 最小改动，贴近真实 owner；不会让 composer 组件持有 DOM scroll 细节 |
| B. 在 `ContextBar` 点击按钮时发一个新的 scroll intent event | 新增独立事件字段或新 event name，由 `Messages` 监听执行 | 语义更显式，但需要扩展跨组件 event contract；当前需求用已有 detail 足够 |
| C. 删除 `autoScrollRef` 隐藏锁 | 只要 preference enabled 就一直滚到底 | 会破坏用户上滚阅读时暂停跟随的保护，回归风险高 |

选择方案 A：`Messages` 是 scroll owner，且已有 `MESSAGES_LIVE_CONTROLS_UPDATED_EVENT` 是控制面到幕布的同步通道。只在 enabled event 上执行一次 imperative scroll，符合当前需求且不扩大 API。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `conversation-render-surface-stability`: live auto-follow control re-enable MUST re-arm the current message viewport and return to latest output during active work.

## Impact

- Affected spec:
  - `conversation-render-surface-stability`
- Affected code:
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/Messages.live-behavior.test.tsx`
- APIs / dependencies:
  - No new dependency.
  - No backend or Tauri command change.

## 验收标准

- 用户滚离当前运行中幕布底部后，重新开启“焦点跟随”会立即滚动到底部。
- 后续 streaming 输出继续 auto-follow。
- 用户手动滚离底部后，在未重新开启或未回到底部前，系统不强制抢回视口。
- 静态 history item change 仍不触发 live auto-follow scroll。
- Focused Vitest 覆盖上述 re-arm 行为并通过。
