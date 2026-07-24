## Context

当前应用用 `AppMode` 切换 chat、kanban 与 git history。Extensions 属于全局管理 surface，不依赖 active workspace，也不应复用 workspace content/right-panel layout。Sidebar 是各 desktop top-level mode 共用的唯一导航外壳。

## Decisions

### Decision: Extensions 继续使用 AppMode，但由 layout short-circuit

`appMode === "extensions"` 派生 `showExtensions`。Desktop layout 在普通 workspace layout 前直接返回 `Sidebar + extensions main`，从结构上保证 right panel、workspace header、messages 与 composer 不会挂载。

Alternative：在普通 workspace grid 内隐藏各节点。该方式容易遗漏 right panel 或 composer，并保留不必要的 layout coupling，因此不采用。

### Decision: 市场与拓展是两个独立入口

“市场”保留 disabled button 语义；“拓展”是可点击的 mode button。未实现的市场入口不绑定 toast 或 navigation，避免“不可点击”语义漂移。

### Decision: 页面先提供静态管理骨架

本次只实现 CLI selector、固定 tab 顺序、搜索输入和介绍 panel。extension discovery、filesystem scan、install/remove、marketplace navigation、documentation navigation 均不接入，后续以独立 change 扩展。

## Risks

- Responsive layout 可能继续渲染 compact workspace tab；通过 phone/tablet focused condition 和 desktop structural test 保护。
- 页面级 marketplace control 不渲染；后续接入 marketplace navigation 时需用独立 change 补交互 contract。

## Verification

- Sidebar test：两个入口同时存在；Market disabled；Extensions 点击发送 `extensions` mode。
- ExtensionsView test：CLI selector、tab order、marketplace button absence、tab content update。
- DesktopLayout test：Extensions 模式只挂载 Sidebar 与 Extensions 节点，不包含 workspace/right-panel nodes。
