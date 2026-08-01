## Why

现有侧栏只有一个被替换后的“拓展”入口，丢失了应继续展示的“市场”；Extensions 视图也被接入工作区布局，容易残留 workspace topbar、composer 或右侧文件栏。需要按已确认参考图提供独立的 Extensions management surface。

## What Changes

- 左侧 primary navigation 同时保留“市场”和“拓展”：市场置灰且不可点击，拓展进入独立页面。
- Extensions 模式只保留全局 Sidebar；主区域完整渲染 Extensions 页面，不挂载 workspace chrome、conversation composer 或 right panel。
- 页面顶部提供 section pills 与 extension tabs，顺序固定为 `使用统计 / AI框架 / Skills / Mcps / Plugins / Hooks / Rules / Commands / Subagents`，默认定位到使用统计。
- 页面级 `Browse Marketplace` 不渲染，避免展示未接入的冗余入口。
- 页面主体使用与参考图一致的单块 extension introduction panel，正文统一展示“即将实现”，不展示添加或文档按钮。

## Capabilities

### New Capabilities

- `extensions-management-surface`: 独立 Extensions 导航、布局与基础交互契约。

### Modified Capabilities

无。

## Impact

- Frontend: `Sidebar`、`AppLayout`/responsive layouts、`ExtensionsView`、i18n、feature CSS 与 focused Vitest。
- Backend/API/dependencies: 无变更。

## 验收标准

- Sidebar 中“市场”与“拓展”同时存在；市场 disabled，拓展可进入页面。
- Desktop Extensions 页面不渲染 right panel、workspace header、messages 或 composer。
- section pills 与七个 extension tabs 按指定顺序显示，首个 active tab 为使用统计，框架入口显示为“AI框架”。
- Extensions 页面不展示 `Browse Marketplace`、`添加` 或 `文档` button。
- focused Vitest、lint、typecheck、large-file check 与 OpenSpec strict validation 通过。
