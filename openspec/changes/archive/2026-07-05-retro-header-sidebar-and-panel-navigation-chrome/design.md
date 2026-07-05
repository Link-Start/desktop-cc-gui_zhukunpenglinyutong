## Context

记录 thread list 折叠排序、open-app toolbar pin、MainHeader 降噪、Plan panel 默认折叠、PanelTabs 可见性、Sidebar version/plugin entry。

Header、Sidebar、Panel tabs 是全局导航骨架，不是普通视觉细节。它们决定用户如何进入 session、打开 app surface、切换 panel、看到版本/插件入口。

## Decisions

- Header 优先承担 session/app navigation，不承担 branch/worktree 管理。
- Panel visibility 来自 activation/pin/explicit persistence，而不是 live state alone。
- Sidebar metadata entries 是辅助入口，不打断主导航。

## Risks And Guardrails

- 移除 header 入口后用户找不到 branch/worktree 操作。
- Panel live activity 不外显后可能降低发现性。
- 防线：保留可替代入口和显式 pin/activation。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-header-sidebar-and-panel-navigation-chrome --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
