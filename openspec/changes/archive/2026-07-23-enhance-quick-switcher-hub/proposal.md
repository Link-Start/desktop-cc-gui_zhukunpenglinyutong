## Why

Quick Switcher（⌘E「最近活动」面板）目前的快速导航只有 10 个入口，而客户端已存在多个真实可达、有 canonical open action 的能力从未接入；同时面板只能「回看历史」，无法感知当下——`sessionRadarFeed.runningSessions`（进行中 AI 会话）已在 app-shell 根链存在，却从未呈现到任何快速入口。用户在多个 workspace 并行跑 AI 任务时，缺少一个「一眼看到正在跑什么、一键跳回去」的入口。

本变更把 Quick Switcher 从「最近记录查看器」升级为轻量「活动中心」。

## 目标与边界

- 快速导航新增 3 个入口：全局搜索、便签、项目记忆，全部复用既有 canonical actions，不新增后端命令。（初版曾包含新建会话与帮助文档共 5 个入口，用户验收后决定移除这两项。）
- 最近会话栏顶部新增「进行中」live 区：展示 `sessionRadarFeed.runningSessions`（根链既有数据，零新增订阅/定时器/轮询），点击跳转会话（跨 workspace 复用既有链路）。
- 保持三栏结构、键盘模型与既有视觉语言；新增行/入口遵循现有 keyboard contract（方向键、Enter、Esc）。

## 非目标

- 不接入 MCP 市场 / 插件市场 / 长期记忆（确认为 comingSoon 占位）。
- 不接入运行日志（toggle 语义需额外状态守卫）、主题切换（无 toggle action）、更新中心（需产品决策）、status-panel（空态语义受限）——均记录为后续候选。
- 不改变 Quick Switcher 的非搜索定位（不加搜索框）；不重构 app-shell 根链。
- 不提交 git commit；实现完成后由用户验收。

## What Changes

- `QuickSwitcherNavigationId` 新增 `globalSearch` / `notes` / `memory`；NAVIGATION_ITEMS 增加对应行（语义 icon + 既有 i18n 风格），`globalSearch` 为导航栏第一项。
- 导航 action 路由：`globalSearch` / `notes` / `memory` 在 `useAppShellLayoutNodesSection` 的 `handleQuickSwitcherNavigate` wrapper 拦截（与 spec/intentCanvas/projectMap 同构），分别接 `handleOpenSearchPalette` / `handleOpenNotes` / `handleOpenProjectMemory`。
- 新增 `QuickSwitcherRunningSession` 类型与 `runningSessions` prop：sessions pane 顶部渲染「进行中」区（live pulse badge + engine icon + workspace 名 + 相对开始时间），点击走既有 `onSelectSession(workspaceId, threadId)`（跨 workspace 切换已验证）；running 会话从下方「最近会话」分组中去重。
- i18n：10 个 locale 同步新增 key；新增定向 unit/component tests 与 OpenSpec contract。

## 技术方案对比

### 方案 A：running 会话作为 sessions pane 顶部固定区（采用）

- 不新增 pane，键盘模型只增加行数不改变 pane 结构；running 区为空时不渲染。
- 优点：键盘导航风险最低、视觉上是「活动优先于历史」的自然层级；缺点：running 行与 recent 行异构，需要去重。

### 方案 B：新增第四个「进行中」pane（不采用）

- 优点：结构最清晰；缺点：pane union / movePane / 每 pane index state / clamp / Enter 分发全部要扩展，四栏布局在紧凑宽度下拥挤，收益不抵风险。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `quick-context-switcher`: 导航入口扩展与进行中会话感知。

## 验收标准

- 3 个新导航入口渲染在快速导航栏，激活后分别：打开全局搜索（互斥关闭自身）、打开便签、打开项目记忆；激活后面板均按既有语义关闭。
- 存在 running 会话时，最近会话栏顶部出现「进行中」区：显示 live 指示、会话标题、workspace 名与相对开始时间；点击任意 running 会话跳转到对应 workspace 的对应会话。
- running 会话不重复出现在下方「最近会话」分组；无 running 会话时该区域不渲染、不占位。
- 方向键/Enter/Esc 在新增区域与入口上行为与既有行一致。
- light/dark theme 下新视觉元素（live badge、分区标题）正常。
- 相关 focused Vitest、targeted lint/typecheck 与 `openspec validate enhance-quick-switcher-hub --strict --no-interactive` 通过。

## Impact

- Frontend：`src/features/quick-switcher/**`、`src/app-shell-parts/useAppShellQuickSwitcherSection.ts`、`src/app-shell-parts/useAppShellLayoutNodesSection.tsx`、`src/app-shell.tsx`（传参）、`src/app-shell-parts/useAppShellSearchAndComposerSection.ts` 与 `renderAppShell.tsx`（prop 中继）、`src/styles/quick-switcher.css`、i18n locales。
- Storage：无变更。Dependencies：无新增。
- 数据流：复用根链既有 `sessionRadarFeed.runningSessions`（runningLimit 12），不新增 store 订阅、定时器或轮询。
