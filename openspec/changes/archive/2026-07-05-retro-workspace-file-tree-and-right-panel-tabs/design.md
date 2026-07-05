## Context

记录 file tree panel 重做、root actions、fileTreeIcons、right-panel tabs pinning 的工作区导航变化。

File tree 是桌面 AI 编程客户端的核心工作区入口。用户从这里打开、预览、复制、粘贴、重命名文件，也会通过右侧面板切换 diff、file view、project surfaces。

## Decisions

- File tree root actions 留在 files feature boundary。
- File tree icons 属于 feature utility，不上升到 app-shell。
- Right-panel pinning 属于 layout/panel behavior，由 PanelTabs contract 约束。

## Risks And Guardrails

- Panel pinning 可能导致 tab strip 拥挤。
- File tree root actions 重做可能影响文件操作入口。
- 防线：FileTreePanel、FileTreeRootActions、PanelTabs tests。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-workspace-file-tree-and-right-panel-tabs --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
