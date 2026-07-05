## Why

多引擎客户端不能把 Composer 的 model/effort/permission/plan mode 当成全局单值。Claude、Codex 等 engine 的默认模型和授权策略不同，用户在一个 engine 上的选择不应悄悄覆盖另一个 engine。

既成事实是：per-engine composer prefs 已实现，context usage indicator 已改成 ai-elements 风格，`ClaudeContextCard` 被抽出以瘦身 Composer/Messages chrome。

这组变更需要规范化，因为它同时涉及持久化偏好、UI 指示和 context usage 可信度表达。OpenSpec 要明确：pending/estimated/live usage 不能混成一种“确定值”。

## What Changes

- 持久化 per-engine composer preferences。
- 保留 provider/model override precedence。
- 重做 context usage indicator。
- 抽取 `ClaudeContextCard` 并降低 Composer/Messages chrome 耦合。

## Scope / Impact

- Affected commits: `d94ad984`, `b9a10e40`, `908b7000`.
- Impact file/surface: `src/app-shell-parts/composerEnginePrefs.ts`
- Impact file/surface: `src/features/composer/**`
- Impact file/surface: `src/features/models/**`
- Impact file/surface: `src/features/threads/**`
- Impact file/surface: `src/components/ai-elements/**`

## Non-Goals

- 不新增 provider credential storage。
- 不改变 backend model detection protocol。
- 不改变 thread message schema。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
