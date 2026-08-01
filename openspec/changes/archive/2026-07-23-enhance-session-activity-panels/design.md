## Context

`最近活动` 相关实现分散在三个 feature 域：

- `src/features/session-activity/`：`WorkspaceSessionRadarPanel.tsx`（跨项目雷达）、`WorkspaceSessionActivityPanel.tsx`（会话内时间线）、`useSessionRadarFeed.ts`、`sessionRadarPersistence.ts`（store `leida`）、`sessionRadarHistoryManagement.ts`。
- `src/features/quick-switcher/` + `src/app-shell-parts/useAppShellQuickSwitcherSection.ts`：三栏快速切换器与导航 action wiring。
- titlebar / layout：右侧面板收起/展开 affordance 与 `PanelTabs` live 提示。

本变更的全部发现来自一次只读代码审查（证据含文件:行号），问题确认存在且互相独立，可分领域并行修复。

## Goals / Non-Goals

- Goals：见 proposal「目标与边界」。核心约束是**编码边界**——所有修复在所属文件域内闭环；**兼容性**——持久化数据惰性修剪、无 schema migration、不新增依赖、不触碰 adapter 事件模型与 AGENTS.md 渲染红线（不新增轮询、不把高频 setState 挂上根链）。
- Non-Goals：见 proposal「非目标」。

## Decisions

### D1：Radar 持久化边界采用「merge 时惰性修剪」而非 migration

- `mergePersistedRadarRecentEntries` 合并时执行：① 30 天 TTL 过滤（以 `completedAt` 为准）；② 每 workspace 50 条 + 全局 200 条截断（保留最新）；③ 返回结果同时产出 `prunedEntryIds`，调用方同步清理 `dismissedCompletedAtById` 中不存在的 id。
- 旧版本写入的超限数据在下次任何 merge（完成检测、删除、回写）时自然收敛，无需启动时一次性 migration，避免启动路径新增磁盘 IO。
- `DEFAULT_RECENT_LIMIT` 从 `Infinity` 改为常量 `RADAR_RECENT_GLOBAL_LIMIT = 200`；`parsePersistedRadarRecentEntry` / `RADAR_STORE_NAME` 统一从 `sessionRadarPersistence.ts` 导出，`useSessionRadarFeed.ts` 删除本地副本。
- 备选：启动时主动 migration——不采用，增加启动 IO 且收益等同惰性修剪。

### D2：完成记录补偿放在 feed 层 reconcile，受 dismissed cutoff 保护

- `useSessionRadarFeed` 在 threads map 变化后执行 reconcile：对每个 `isProcessing === false` 且存在 `updatedAt` 的 thread，若 store 中无该 thread 的完成记录且 `updatedAt` 晚于既有 `completedAt`，补写一条完成 entry（`completedAt = thread.updatedAt`）。
- 已删除历史不复活由现有机制保证：`isRecentEntryDismissed` 的 cutoff 取三方最大值，补写前先检查 dismissed cutoff，`updatedAt <= cutoff` 的跳过。
- reconcile 结果走既有 signature-gated 持久化写盘路径，不新增 immediate 写盘次数。
- 备选：在落盘/加载历史的 backend 路径补写——不采用，越出前端 feature 边界。

### D3：收起态 live 信号挂在展开 affordance，复用现有 feed 数据

- 右侧面板收起时，在展开按钮（titlebar/layout 的 right-panel toggle）上叠加 running 会话计数徽章；数据来自既有 `sessionRadarFeed.runningSessions.length`（已在根链存在，见 `useLayoutNodes.tsx` radarLive），不新增 store 订阅、不新增定时器。
- 徽章为纯展示，不自动展开面板、不抢焦点；`aria-label` 包含计数文案。无 running 会话时不渲染徽章。
- i18n：10 个 locale 的 `activityPanel.ts` 增加同一 key（如 `collapsedLiveBadge`），保持 key parity。

### D4：Quick Switcher 导航项接通 canonical actions，接不通则移除

- `handleQuickSwitcherNavigate` 的 `spec` / `intentCanvas` / `projectMap` 空 case 接通 `useAppShellLayoutNodesSection` 中已有的 canonical open actions（与 `add-quick-switcher` change 5.3 的既有约定一致：Spec Hub 打开独立窗口）。
- 若某 action 在当前 wiring 下不可达，移除该导航项，禁止保留无响应项。
- 不新增导航项、不改变三栏结构。
- 收尾核实：三个导航项在 runtime 已由 wrapper 接通 canonical actions，base 空 case 属 shadowed 兜底，原「死项」诊断不准确；实际落地收缩为委托契约注释 + wiring 守护测试，无行为变更（见 tasks.md 3.1 备注）。

### D5：Activity 时间线无障碍最小补齐

- diff 预览模态框：打开时焦点移入容器、Escape 调 `closeDiffPreview`（保留脏状态拦截链）、关闭后焦点归还触发卡片；不引入第三方 focus-trap 依赖，用 container ref + keydown 实现。
- tablist：主分类与产物子 tablist 支持 `ArrowLeft/ArrowRight` 移动并激活 tab，roving tabindex；`role="tab"` 与 `role="tabpanel"` 补 `aria-controls`/`aria-labelledby` 配对。
- follow coach：自动消失时间 1000ms → 8000ms；自动消失只隐藏当次，**不写入** `soloFollowCoachDismissedByWorkspace`（仅用户点击 dismiss 才永久写入）。
- reasoning 跟随：容器记录用户 scroll 方向，`scrollTop + clientHeight < scrollHeight - 48` 时暂停自动跟随，容器底部显示「回到底部」悬浮按钮；用户回底后恢复跟随。
- 折叠 turn header：追加摘要徽章（事件计数 + 文件变更 `+n/-m`），复用既有 `buildTurnArtifactSummary`，组件内 `useMemo` 按 `group.events` 引用缓存，不改变 adapter 输出。

### D6：Radar 面板交互一致性

- `collapsedDateGroups` 默认值从「全部折叠」改为「仅最新日期组展开」，其余维持用户手动态；修剪已不存在 dateKey 的陈旧记录。
- `showDeleteAction` 不再以 `!isUnreadRecent` 为条件，未读条目同样展示删除按钮；行点击仍触发跳转 + 标已读，语义不变。
- 删除失败：`deleteSessionRadarHistoryEntries` 返回的 `failed` 数组非空时展示错误提示（复用 follow 错误气泡模式，`role="alert"`），不再静默。
- 日期组删除前使用 `window.confirm` 或既有确认组件二次确认。
- 面板监听 `SESSION_RADAR_HISTORY_UPDATED_EVENT`，收到后重读 readState / collapsedDateGroups / dismissed 状态，与设置页历史管理保持同步。

## Risks / Trade-offs

- **多文件并行修改冲突**：`useSessionRadarFeed.ts` 同时承载 D1/D2，由同一 worker 完成；`WorkspaceSessionRadarPanel.tsx`（D6）与 feed 层（D1/D2）文件不重叠；`useAppShellSearchRadarSection.ts` 仅 D2 触碰 completion 块；D3 若需改 `useLayoutNodes.tsx`，仅追加只读派生，不改既有逻辑。
- **i18n 漂移**：新增 key 必须同步 10 个 locale（`zh/zh-TW/en/ja/ko/fr/es/ru/pt-BR/hi` 等，以 `src/i18n/locales/` 实际目录为准），worker 完成后跑 locale parity 检查。
- **徽章视觉回归**：D3 徽章使用既有 theme token，不新增 CSS 变量；收起态布局变化仅限按钮内嵌 badge，不影响面板宽度计算。
- **测试基线**：`WorkspaceSessionRadarPanel.test.tsx:252` 断言日期分组折叠按钮 `aria-expanded` 为 null——D6 改动需同步更新该断言为正向断言。

## Migration Plan

- 无数据 migration；旧持久化数据经 D1 惰性修剪收敛。
- 无 feature flag；全部行为直接上线，由用户手动验收（不提交 commit）。
- 回滚方式：`git checkout --` 还原本变更触及的文件。

## Open Questions

- ~~D3 徽章的具体宿主组件（titlebar vs sidebar toggle）由实现 worker 探索后选择「已有 right-panel toggle 按钮」为准，并在 tasks 4.3 记录实际位置。~~ **已回填（结论）**：徽章宿主为 titlebar 侧 `MainHeader` 的 right-panel 独立图标按钮——`src/features/app/components/MainHeader.tsx` 中 `id === "right-panel"` 的 `TooltipIconButton`（收起态图标 `PanelRightOpen`）；计数数据源为既有 `sessionRadarFeed.runningSessions.length`（经 `openAppExtraActions` 注入 `badgeCount`），无新增订阅/定时器。
