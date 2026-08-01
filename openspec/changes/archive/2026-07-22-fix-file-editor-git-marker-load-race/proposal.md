## Why

文件编辑器当前会在打开 changed file 时立即并行请求文件内容与 `getGitFileFullDiff`。这既增加 file-open hot path 的 Git/IPC 开销，又因 diff result 使用 `snapshotVersion` guard、但 effect 不随 snapshot reload 而重跑，导致 changed-line markers 取决于异步返回顺序，表现为同一文件有时有 Diff 高亮、有时没有。

## 目标与边界

- 默认打开文件只完成 document read 与 first useful viewport，不主动加载 Git full diff。
- 用户启用 `Git Blame` 后，按需加载 Blame 与 changed-line markers；两条 side channel 独立结算、独立失败。
- 关闭 `Git Blame` 时隐藏 workspace Git-derived changed-line markers；切换文件、snapshot 或 unmount 后不得提交 stale markers。
- `added` / `untracked` 文件即使 Blame 本身不可用，只要 canonical full diff 可用，仍可显示 changed-line markers。

## 非目标

- 不改变 Git Diff panel、editable diff review surface 或 `+/-` 统计口径。
- 不修改 backend Git command、Blame payload 或文件保存契约。
- 不新增持久化设置、全局 cache 或依赖。
- 不改变 conversation/activity 显式传入的 `highlightMarkers`；它们不是 file-open eager Git work。

## What Changes

- 移除 `FileViewPanel` 在 ordinary file open 阶段的 eager full-diff request。
- 将 marker request 改为由 `gitBlame.enabled` 触发，并等待 initial document load 完成。
- 使用 file/snapshot request identity 与 effect cleanup 拒绝 stale result；不让失败影响文件内容或 Blame gutter。
- 增加 focused Vitest，覆盖默认不加载、点击后加载、关闭隐藏、乱序切换与 Blame failure independence。

## 技术方案对比

1. **推荐：Git Blame toggle 驱动 lazy marker request**。复用现有交互入口和 `getGitFileFullDiff` parser；默认零额外 diff 开销，点击后 Blame/diff 可独立并发，改动集中在 `FileViewPanel`。
2. **仅修复 eager race**。等待 document read 后继续自动请求 diff；可保持旧视觉，但所有 changed file 仍承担 Git/IPC 成本，不符合新的按需加载目标。
3. **从 Blame hunks 推导 markers**。可少一次请求，但只能识别 `Uncommitted` 范围，无法可靠区分 added/modified，且新增/未跟踪文件可能没有可用 Blame，不满足 marker 语义。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `file-open-rendering-scheduler`: changed-line markers 从 file-open eager work 改为 Git Blame user intent 触发的 guarded side channel。

## 验收标准

- 普通打开 changed file 不调用 `getGitFileFullDiff`，文件内容和 CodeMirror 正常可用。
- 点击 `Git Blame` 后调用现有 Blame 与 full-diff service，并显示可解析 markers。
- 关闭 `Git Blame` 后 markers 清空；重新启用可再次收敛。
- Blame reject 不阻止 diff markers；diff reject 不隐藏已成功的 Blame gutter。
- file A 的延迟 diff 不得写入 file B；目标测试、typecheck、lint 与 strict OpenSpec validation 通过。

## Impact

- Frontend：`src/features/files/components/FileViewPanel.tsx` 及 focused tests。
- Runtime/API：继续复用 `getGitFileBlame`、`getGitFileFullDiff`，无 signature 变更。
- 性能：默认 file-open 减少一次 Git full-diff IPC/subprocess；仅在用户明确启用 Git Blame 时加载。
- 回滚：恢复 eager marker effect trigger 即可；无数据迁移或 persisted state 影响。
