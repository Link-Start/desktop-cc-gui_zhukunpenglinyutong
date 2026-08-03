## Context

- 恢复卡文案引导 Fork，但 `handleThreadRecoveryFork` 仅 `startFork("/fork")`。
- `startFork` → `forkThreadForWorkspace` → Codex `thread/fork`；父 id 已 not found 时 fork 失败。
- `forkThreadForWorkspace` catch 后 `return null`；`startFork` 对 null **静默 return**。
- `recoverThreadBindingAndResendForManualRecovery` 已有 `fork → fresh`，但恢复卡 Fork **不走**该路径，且 resend 需要上一条消息。

## Goals / Non-Goals

**Goals**

1. 恢复卡 Fork = **explicit continuation**（无强制 resend）：native fork 优先，失败则 fresh。
2. classified outcome：`forked` | `fresh` | `failed`。
3. 失败可见；成功切换 active thread。
4. 复用现有 workspace fork/start primitives。

**Non-Goals**

- 完整历史注入 fresh thread。
- 改变 durable rebind 的保守语义（recover-only 仍仅 verified rebound 算「已恢复」）。

## Decisions

### D1. 新增 recover-only continuation（无 message）编排函数

在 `manualThreadRecovery.ts` 增加例如：

`continueStaleThreadBindingForManualRecovery(...)`

阶梯：

1. （可选）不强制 refresh/rebind 为成功前提——父 thread 已证明 not found。
2. Codex：`forkThreadForWorkspace`；得到 id → `{ kind: "forked", threadId }`。
3. fork null/throw → `startThreadForWorkspace({ activate: true, engine })` → `{ kind: "fresh", threadId }`。
4. 仍失败 → `{ kind: "failed", reason, ... }`。

非 Codex 引擎：若 fork 不可用，可直接 fresh（与现有 engine 策略一致）；本变更主验证 Codex。

### D2. 恢复卡 Fork 改绑到 continuation，而非 `startFork`

`handleThreadRecoveryFork`：

- 需要 `workspaceId` + `threadId`（从 Messages/card 已有 props 传入，或 shell 用 active ids）。
- 调用 `continueStaleThreadBindingForManualRecovery`。
- `failed` → throw / 返回 failed，供卡片 `reconnectStatus=error`。
- `forked`/`fresh` → 已由 `activate: true` 切会话；卡片随旧 thread 卸载。

### D3. RuntimeReconnectCard 对 outcome 的处理

保持「stale 主按钮 = Fork」；点击时：

- 继续调用 `onThreadRecoveryFork`。
- 若 callback 返回 classified result 或 throw：failed 展示错误；成功可短显 forked/fresh 文案（可选，因切会话后卡片常卸载）。

最小改动：callback 在 failed 时 **throw Error(reason)**，成功 resolve；与现卡 catch 逻辑兼容。更稳妥：callback 返回 `RuntimeReconnectRecoveryCallbackResult`，卡片 normalize 后设 status——与 recover 路径一致更佳。

**采用**：`onThreadRecoveryFork` 升级为可返回 classified result（或 void），卡片若收到 result 则 normalize；若 void 则视为成功（兼容旧测试 mock）。

### D4. 文案

- `threadRecoveryRecommendation`：点明优先 Fork，失败则新建会话承接。
- 不改主按钮短文案 `Fork`（避免大面积 i18n 噪音）；可选副文案。

### D5. 与旧 spec 冲突的修订

旧 delta 曾写：

- MUST call shared Fork，MUST NOT call recover-and-resend
- MUST NOT require runtime reacquire

修订为：

- MUST 使用 shared **primitives**（forkThread / startThread），可经 manual recovery 编排
- MUST NOT 伪装成 recover-and-resend（无强制重发上一条）
- 仍可不先 reacquire 死 thread；fresh 创建前可由 startThread 自带 runtime 就绪

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| fresh 丢失 native 上下文 | 文案说明「新会话承接」；历史幕布仍在旧会话可读 |
| 双重点击重复建会话 | 卡片 `isReconnectRunning` 已防重入 |
| 与 slash `/fork` 行为分叉 | 有意：slash 保持原语义；恢复卡走 continuation |
| 误对非 stale 调 fresh | 仅绑定恢复卡 Fork 回调 |

## Migration

无数据迁移。无 alias 强制写入（fresh/fork 成功不把死 id 标成 recovered，除非既有 verified rebind 路径）。

## Open Questions

- 无阻塞问题。本地历史投影留作 follow-up。
