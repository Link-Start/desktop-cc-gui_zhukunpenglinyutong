## Context

记录 app-shell root render storm 降噪、visibility-gated polling、Composer state 下沉、virtualizer 精准测量和 CSS containment 修复。

桌面 AI 客户端的复杂度集中在 app-shell：消息、Composer、Sidebar、Session Activity、Search、Status Panel、Runtime Notice 都可能同时更新。根节点一动就让重子树全量重渲染，是典型 render storm。

## Decisions

- 优先隔离 state 和稳定 callback，而不是盲目 memo。
- Polling/listener 必须有 owner 和 visibility gate。
- Virtualizer cache invalidation 应精准，不应破坏 scroll stability。

## Risks And Guardrails

- 过度 gate polling 导致用户可见数据滞后。
- 稳定 callback 闭包拿到旧状态。
- 防线：foreground-visible state 不允许被后台优化延迟。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-render-storm-and-background-polling-controls --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
