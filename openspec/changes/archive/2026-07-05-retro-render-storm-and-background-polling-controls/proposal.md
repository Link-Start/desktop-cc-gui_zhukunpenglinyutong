## Why

桌面 AI 客户端的复杂度集中在 app-shell：消息、Composer、Sidebar、Session Activity、Search、Status Panel、Runtime Notice 都可能同时更新。根节点一动就让重子树全量重渲染，是典型 render storm。

既成事实是：实现已经引入 stable event callback、visibility-gated interval、Composer state 出 root、后台 polling 暂停、virtualizer mounted row remeasure，并修复 `contain: strict` 导致 scroll viewport 变 0px 的问题。

这个补提案要明确：性能优化不是简单少刷新，而是把不可见/无关工作从前台交互路径移开，同时不得延迟 visible composer、stop、approval、error state。

## What Changes

- 减少 app-shell root render 对 heavy subtree 的影响。
- 引入 `useEventCallback` 和 `visibilityGatedInterval`。
- 将 Composer/status/session 部分状态从 root render storm 中隔离。
- virtualizer 改为 remeasure mounted rows，而不是清空 size cache。
- 修复 CSS containment collapsing scroll viewport。

## Scope / Impact

- Affected commits: `bb74ff52`, `b7ab1e6c`, `fd95f765`, `55e52b88`, `638c56af`.
- Impact file/surface: `src/app-shell-parts/**`
- Impact file/surface: `src/features/layout/**`
- Impact file/surface: `src/features/messages/**`
- Impact file/surface: `src/features/composer/**`
- Impact file/surface: `src/services/visibilityGatedInterval.ts`
- Impact file/surface: `src/utils/useEventCallback.ts`
- Impact file/surface: `src/styles/sidebar.css`
- Impact file/surface: `src/styles/home-chat.css`

## Non-Goals

- 不移除必要 live runtime polling。
- 不改变 session catalog source facts。
- 不改变 message content semantics。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
