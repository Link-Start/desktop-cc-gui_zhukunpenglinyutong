## Why

Create Worktree dialog 当前预填 `codex/<date>-<random>`，名称既不表达任务意图，也会让非 Codex engine 创建的 worktree 带上错误来源。系统没有可靠的任务目的输入，自动生成“语义名称”会制造虚假语义。

## What Changes

- 打开 Create Worktree dialog 时将 branch name 初始化为空
- 复用现有 required validation、Git ref validation、字段说明与示例提示，引导用户填写真实分支名
- 保持 baseRef、publish、setupScript、create payload 与 backend contract 不变
- 更新 focused hook/component tests，锁定空默认值和提交 guard

## 目标与边界

- 目标：停止创建无语义、engine-biased 的默认分支名，让 branch name 来自用户真实意图
- 边界：不新增字段，不自动推断 task type，不修改 Git backend
- 验收：dialog 打开时 branch 为空；未填写时 Create 保持不可用或被现有 guard 阻止；填写合法名称后原创建流程不变

## 非目标

- 不增加“工作目的”输入
- 不做中文拼音、AI slug、workspace slug 或 branch type 推断
- 不修改 base branch 默认值、publish behavior 或 setup script

## 技术方案取舍

- **方案 A：branch 默认留空（采用）**：复用现有输入、i18n hint 与 validation，改动最小，名称语义由用户负责，系统不伪造意图
- **方案 B：新增工作目的并生成 slug**：可减少输入，但引入新 UI/state/i18n、slug policy 与双字段同步，且用户没有要求该额外能力
- **方案 C：生成 workspace-based 名称**：能移除 `codex/` 偏见，但仍不能表达任务意图，未解决根因

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-worktree-base-selection`: Create Worktree dialog 不再生成默认 branch name，必须由用户显式填写合法名称

## 验收标准

- 每次打开 dialog 时 branch name 为空，不残留上次或随机默认值
- 空 branch 无法提交，并显示/复用既有 required validation
- 合法 branch、baseRef、publish 与 setupScript payload 保持兼容
- focused Vitest、targeted ESLint、TypeScript typecheck 通过

## Impact

- `src/features/workspaces/hooks/useWorktreePrompt.ts`
- `src/features/workspaces/components/WorktreePrompt.tsx` 的既有 validation contract
- 对应 hook/component tests
- 无 backend、IPC、持久化或 dependency 变化
