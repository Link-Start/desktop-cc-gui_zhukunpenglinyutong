## Why

当前客户端的 `⌘O` Global Search 适合已知目标的主动检索，但缺少面向短期工作记忆的低成本切换入口。用户需要一个类似 IntelliJ IDEA Recent Files/Switcher 的精致面板，在不输入搜索词的情况下快速返回最近会话、最近文件或常用工作区工具。

## 目标与边界

- 在现有 Global Search icon 旁提供独立 Quick Switcher icon，并支持 `⌘E` / `Ctrl+E`。
- 右侧将 `最近会话` 与 `最近文件` 并行分栏展示；每栏全局最多 30 条，并在栏内按 workspace 分组。
- 最近文件同时接收用户打开/激活与 AI 实际创建/修改成功两类信号；读取、搜索或提及不计入。
- 左侧只展示客户端已有且当前可达的核心功能入口，所有入口与结果行均使用语义 icon。
- Quick Switcher 仅服务 desktop workspace，不替代 Global Search。

## 非目标

- 不提供搜索框、隐藏式 typing filter、内容 provider 或 index hydration。
- 不复制所有插件、命令和低频入口。
- 不引入新的第三方依赖，不改变现有 `⌘O` Global Search 行为。
- 不在本变更中重构 App Shell 或其他无关导航代码。

## What Changes

- 新增 lazy-loaded Quick Switcher feature、独立样式与可访问的三栏键盘导航。
- Quick Switcher 使用三栏结构：快速导航 / 最近会话 / 最近文件；最近内容在各自栏内增加 workspace hierarchy。
- 新增 workspace-scoped recent-file MRU：按 `workspaceId + path` 去重，最多保留并展示 30 条；第 31 条进入时淘汰最旧记录。
- AI 文件变更仅在已有文件变更事实确认后进入 MRU，并保留轻量来源标记。
- 最近会话复用现有 `ThreadSummary.updatedAt`，最多展示 30 条。
- Spec Hub、意图画布和项目地图必须复用客户端现有 canonical open action；Spec Hub 打开独立窗口。
- 新增 Quick Switcher 定向 unit/component tests 与 OpenSpec contract。

## 技术方案对比

### 方案 A：独立 feature + 复用现有导航事实（采用）

- Quick Switcher 只维护必要的 recent-file MRU；会话、工具入口和导航 callback 复用现有状态。
- 优点：边界清晰、不会污染 Global Search、增量成本可控。
- 缺点：需要少量 App Shell wiring，并为 AI 文件修改接入既有事实流。

### 方案 B：扩展 Global Search 空查询态（不采用）

- 在 Search Palette query 为空时展示最近会话、文件和工具。
- 优点：复用现有弹窗状态和快捷键基础设施。
- 缺点：混淆“搜索”与“恢复上下文”，增加 Search Palette 根链状态和渲染负担，也无法满足独立 icon/快捷键的产品语义。

## Capabilities

### New Capabilities

- `quick-context-switcher`: 定义 Quick Switcher 入口、分类数据、MRU、键盘操作、视觉层级与导航行为。

### Modified Capabilities

<!-- None. Existing Global Search and navigation contracts remain unchanged. -->

## 验收标准

- 点击新 icon 或使用 `⌘E` / `Ctrl+E` 可打开和关闭 Quick Switcher，`⌘O` 行为不变。
- 最近会话和最近文件保持两个独立 section，各自最多 30 条，最新项在最上方。
- 用户打开文件与 AI 实际修改文件均可进入 recent-file MRU；重复路径刷新时间且不产生重复行。
- 所有可交互项具有 icon、可访问名称，并支持方向键、`Enter`、`Esc`。
- light/dark theme、有限高度滚动与当前项 presentation 正常。
- 相关 focused Vitest、targeted lint/typecheck 与 OpenSpec strict validation 通过。

## Impact

- Frontend：`src/features/quick-switcher/**`、titlebar control、App Shell feature wiring、feature style loader、i18n。
- Storage：复用现有 client store 写入 workspace-scoped recent-file MRU；不新增 backend command 或 schema migration。
- Dependencies：无新增 dependency。
