## Context

`useThreadHistoryLoadingState` 已用 `historyLoadingByThreadId` 表达真实 history restore lifecycle。近期 Layout 又增加 `activeThreadBootstrapLoading = isPendingThreadId(activeThreadId) && activeItems.length === 0`，把 identity 尚未 finalized 的新 draft 也投影成 history loading。disk Codex optimistic draft 会保持 pending 直到首次发送，因此该 presentation state 无法自行 settle。

## Goals / Non-Goals

**Goals:**

- 恢复 `historyLoadingByThreadId` 作为 restoring-history presentation 的 single source of truth。
- 保证 fresh pending draft 立即呈现可输入的空白会话。
- 保留 unloaded history selection 的既有 loading lifecycle。

**Non-Goals:**

- 不改变 pending-to-finalized identity mapping。
- 不改变 Codex thread start、resume、runtime readiness 或 provider selection。
- 不新增 state、helper 或 dependency。

## Decisions

### 删除错误派生，而不是增加 provider-specific guard

直接删除 `activeThreadBootstrapLoading` 及其 import/dependency。`pending` 只表示 identity lifecycle；是否正在 hydrate transcript 必须由专用 loading state 表达。

替代方案是保留派生并排除 `codex-pending-*`。该方案会把错误抽象留给 Claude/Gemini/OpenCode pending drafts，且重复编码已经由 `historyLoadingByThreadId` 解决的逻辑，因此拒绝。

### 在 Layout seam 锁定回归

修改现有 `useLayoutNodes.client-ui-visibility.test.tsx`：同样输入 `codex-pending-* + empty items`，断言传给 `Messages` 的 `isHistoryLoading` 为 false。既有 `useThreads.sidebar-cache.test.tsx` 继续覆盖真实 history selection 的 set/clear lifecycle。

## Risks / Trade-offs

- [Risk] 某个 pending thread 曾依赖该 loading 占位避免短暂 empty state → [Mitigation] fresh draft 的正确 UX 本来就是 empty conversation；真实 hydrate 仍由专用 state 覆盖。
- [Risk] 删除 shared pending 判定影响其他 engine → [Mitigation] 所有 engine 的 history restore 必须显式进入 `historyLoadingByThreadId`，identity prefix 不再隐式制造 UI 状态。

## Migration Plan

无需数据迁移。发布后 presentation state 在下一次 render 自动收敛。回滚时可恢复单个派生条件及对应测试。

## Open Questions

无。
