## 1. Orchestration

- [x] 1.1 在 `manualThreadRecovery.ts` 新增 `continueStaleThreadBindingForManualRecovery`：Codex 先 `forkThreadForWorkspace`，失败/null 再 `startThreadForWorkspace({ activate, engine })`，返回 `forked | fresh | failed`
- [x] 1.2 为该函数补 recovery 单测：fork 成功；fork null → fresh；双失败

## 2. Wire recovery card Fork

- [x] 2.1 `handleThreadRecoveryFork` 改为调用 continuation（带 workspace/thread/engine 上下文），不再裸 `startFork("/fork")`
- [x] 2.2 `RuntimeReconnectCard`：Fork 回调可返回 classified result；failed 可见；forked/fresh 状态可展示（切会话后卸载可接受）
- [x] 2.3 更新 `Messages.runtime-reconnect.test.tsx` / layout recovery tests

## 3. Copy

- [x] 3.1 更新 zh/en `threadRecoveryRecommendation`：Fork 优先，失败则新建会话承接；新增 `threadRecoveryForkedContinued` / `threadRecoveryFreshContinued`

## 4. Verify

- [x] 4.1 `openspec validate fix-codex-stale-dead-thread-fork-continuation --strict --no-interactive`
- [x] 4.2 targeted vitest for recovery modules（81 passed）
- [x] 4.3 self-review；**不 commit**
