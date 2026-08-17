# Proposal: fix-session-switch-unlock-windows-jank

> OpenSpec change id: `fix-session-switch-unlock-windows-jank`  
> Skill: `openspec-apply-change`（本轮为二次收口，不是新 change）  
> Evidence: 首轮 identity-then-chrome / empty-cooldown / recovery prefetch 已落地，但 review 仍命中 P0：identity 帧含 `setActiveEngine`、空 surface 同步拉 history-loading 幕布、可判断的 never-started 仍走 resume。禁止 cherry-pick / 整段搬 0.8.9。

---

## Why

0.9 已有 Index-first 侧栏、`startTransition` 导航、Shared 非空 V0 first-paint。三条用户路径仍卡：

1. **没开始对话也切卡**：侧栏 click 的 identity 帧仍含 engine；空 Claude/Shared 在 `setActiveThreadId` 同步 `setThreadHistoryLoading(true)`，再 24ms resume。
2. **只跑一个会话点切换也卡**：后台 gating 不管 click；单会话同样走大 commit + 可能的幕布。
3. **Shared 解锁卡一会**：主按钮是「自动处理」，`findRecoveryOwner` 串行 IPC；空 V0 曾 hard-wait projection。

根因不是「0.8.9 有一段没 merge」，而是 0.9 S4 需要 **更瘦的 identity commit** 与 **never-started / 空 surface 政策**。

## What Changes

- 切会话 identity **只**同步 `selectWorkspace` + `setActiveThreadId`。`setActiveEngine` 进 chrome / `startTransition`。
- 空 surface **禁止**在 select 帧拉 history-loading 幕布。`scheduleClaudeBlankCurtainRecovery` 只处理真正的 blank curtain。
- 可判断的 never-started（`*-pending-*`，或 summary 明确 `sizeBytes===0` 且无 `physicalPath`）**跳过 resume**。`items=[] && !isLoaded` 单独不足以 skip——那也是「有历史但未 hydrate」的正常态。
- 切会话路径 **禁止** `ensureWorkspaceThreadListLoaded({ force })` / full-catalog / disk rescan。不 merge 0.8.9 engine-rail UI。
- Shared recovery：`recovery-required` 预取 owner；click 先让出一帧 paint。成功空 V0 即 Phase-A。

## 目标与边界

- **目标**：Windows 点切会话 / 点自动处理时，选中态与按钮反馈先出现，重活不堵 hit-test。
- **边界**：AppShell S4 domain bag；`commitThreadSelection` / resume policy / recovery prefetch / `sharedHistoryLoader`。
- **非目标**：不 merge 0.8.9；不改 engine registry / ACK / abandon 语义（无 ADR 回写）；不用 timeout 当冷启动修复；不把空 hydrate 标 `loaded=true`；不把 Index 收成唯一 list 源（那是侧栏冷启动，不是 click path）。

## Capabilities

### New Capabilities

- `session-switch-identity-first`：切会话 identity 同步、engine+chrome 过渡；切会话不扫盘。
- `thread-select-resume-policy`：never-started skip、空 surface 不拉幕布、failed / loaded 刷新决策。
- `shared-recovery-click-paint`：recovery click 让出绘制 + owner prefetch。

### Modified Capabilities

- `shared-history-open-nonblocking`：空 V0 成功响应视为 Phase-A，不再 hard-wait projection。

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| A | identity 只有 workspace+thread；engine 在 chrome 且晚于 identity | `commitThreadSelection` + workspace-flows 单测 |
| B | never-started 不 resume；空 surface 不拉幕布；failed 不自动 resume | policy + `setActiveThreadId` 接线 |
| C | `handleSelectThread` 不调用 `ensureWorkspaceThreadListLoaded` | layoutNodes 接线 + spec |
| D | `recovery-required` 预取 owner；auto 首次用 cache；二次查找不复用 | prefetch 单测 + StatusBar |
| E | 成功空 V0 超时/失败不 throw，返回 Phase-A | `sharedHistoryLoader` 单测 |
| F | `check:app-shell:governance` 绿 | CI 命令 |
| G | Windows WebView2 手测 | **未测**（本环境无 Win） |

## 风险与回滚

- 无 `sizeBytes`/`physicalPath` 的真实会话会走一次后台 resume：无幕布，20s cooldown 防空 Claude 连点。
- 迟到 transcript：过 cooldown 再 hydrate；failed 走显式 `refreshThread`。
- 回滚：engine 拉回 identity；恢复 select 幕布与 empty-Claude force。
