## Why

新建 disk Codex 会话会先产生 `codex-pending-*` optimistic draft；当前 Layout 把“pending identity 且暂无消息”误判成 history restore，导致首次发送前一直显示“正在加载对话窗口”。这混淆了 identity lifecycle 与 transcript loading lifecycle，并回退了空白新会话的正常可用状态。

## 目标与边界

- 新建 Codex pending draft MUST 直接显示空白会话，而不是 restoring-history status。
- 选择真正未加载的历史会话时，继续由 `historyLoadingByThreadId` 驱动 restoring-history status。
- 修复仅限 frontend presentation state，不改变 Codex runtime、provider binding、thread start/finalize 或 transcript 数据。

## 非目标

- 不改变 `codex-pending-*` 的创建、首次发送或 finalized identity 时机。
- 不调整 managed provider、Claude Code 或 backend readiness/recovery 行为。
- 不重做 Messages empty/loading UI。

## What Changes

- 移除 Layout 对所有 empty pending thread 的额外 history-loading 推断。
- 让 history loading 重新只由专用 transient state `historyLoadingByThreadId` 决定。
- 更新 focused regression test，锁定 fresh pending draft 不显示 restoring-history status。

## 方案对比

1. **采用：删除 `activeThreadBootstrapLoading` 派生。** 复用现有 `historyLoadingByThreadId` single source of truth，最小 diff 且符合既有 OpenSpec contract。
2. **拒绝：只对 `codex-pending-*` 增加 engine-specific exclusion。** 能修截图场景，但继续保留“pending identity 等于 history loading”的错误模型，其他 engine pending draft 仍可能漂移。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `conversation-realtime-history-parity`: 明确 freshly-created pending draft 不属于 history restore，只有真实 restore lifecycle 才能显示 restoring-history status。

## Impact

- Frontend: `src/features/layout/hooks/useLayoutNodes.tsx`
- Tests: `src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- Behavior spec: `conversation-realtime-history-parity`
- API / dependency / backend impact: none

## 验收标准

- 新建 disk Codex 会话在首次发送前不再常驻 loading。
- 选择 unloaded Codex history conversation 时仍显示 loading，并在 restore settle 后清除。
- Focused Layout、Messages history-loading、thread loading lifecycle tests 与 TypeScript typecheck 通过。
