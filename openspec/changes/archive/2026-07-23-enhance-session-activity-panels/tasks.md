## 1. Radar 持久化治理与完成记录补偿（feed/store 层）

- [x] 1.1 [P0, depends: none] 在 `sessionRadarPersistence.ts` 实现 TTL（30 天）+ 每 workspace 50 / 全局 200 上限的惰性修剪，merge 返回 `prunedEntryIds`；统一导出 `RADAR_STORE_NAME`，删除 `useSessionRadarFeed.ts` 本地副本与重复 parse/ID 构造函数；以 focused unit tests 验证 TTL、双上限、pruned id 输出、旧数据兼容。
- [x] 1.2 [P0, depends: 1.1] 在 `useSessionRadarFeed.ts` 应用新上限并同步修剪 `dismissedCompletedAtById` 死数据；以 hook tests 验证修剪联动与 signature-gated 写盘不回归。
- [x] 1.3 [P0, depends: 1.1] 在 `useSessionRadarFeed.ts` + `useAppShellSearchRadarSection.ts` 实现完成记录 reconcile：`isProcessing === false` 且 `updatedAt` 晚于已持久化 `completedAt` 的 thread 补写完成 entry，受 dismissed cutoff 保护；以 focused tests 验证启动前完成可补记、已删除不复活、不重复写盘。

## 2. Radar 面板交互一致性（RadarPanel 层）

- [x] 2.1 [P0, depends: none] `WorkspaceSessionRadarPanel.tsx`：最新日期组默认展开、其余维持手动态并修剪陈旧 dateKey；未读条目展示删除按钮；删除失败展示 `role="alert"` 错误提示；日期组删除加二次确认；订阅 `SESSION_RADAR_HISTORY_UPDATED_EVENT` 同步 readState/折叠态；更新 `aria-expanded` 断言（test:252 反向断言改为正向）。
- [x] 2.2 [P1, depends: 2.1] Radar 行内时间改相对时间（复用 `formatRelativeTimeShort` 口径），绝对时间放 `title`；补 component tests。

## 3. Quick Switcher 导航委托契约守护

- [x] 3.1 [P0, depends: none] 为 `useAppShellQuickSwitcherSection.ts` 中 `spec` / `intentCanvas` / `projectMap` 空 case 的 wrapper 委托契约补注释与 wiring 守护测试，防止 spread 顺序调整导致静默退化；无行为变更（runtime 已由 wrapper 接通，见备注）。
  - 备注（收尾核实）：`spec` / `intentCanvas` / `projectMap` 在 runtime 已由 `useAppShellLayoutNodesSection.tsx:1440-1459` 的 wrapper 接通 canonical actions，base handler 的空 case 属 shadowed 兜底；本次仅补注释与 wiring 守护测试、无行为变更。proposal 中「点击无任何效果」的诊断不准确（proposal 已修正归因）。

## 4. 收起态 live 信号

- [x] 4.1 [P0, depends: none] 定位既有 right-panel toggle 按钮，叠加 running 会话计数徽章（数据源 `sessionRadarFeed.runningSessions.length`，无新订阅/定时器）；10 个 locale 同步新 key；以 component tests 验证计数、无 running 不渲染、aria-label。
- [x] 4.2 [P1, depends: 4.1] 在 design.md「Open Questions」记录徽章实际宿主位置。

## 5. Activity 时间线无障碍与跟随体验（ActivityPanel 层）

- [x] 5.1 [P0, depends: none] `WorkspaceSessionActivityPanel.tsx`：diff 预览模态框 Escape 关闭（脏状态走既有 `UnsavedChangesDialog`）+ 焦点移入/归还；主/子 tablist 方向键 + roving tabindex + `aria-controls`/`aria-labelledby` 配对；以 component tests 验证 Escape、焦点、方向键。
- [x] 5.2 [P0, depends: none] follow coach 自动消失 1000ms→8000ms，自动消失不写入永久 dismiss；reasoning 跟随在用户上滚超 48px 时暂停并显示「回到底部」悬浮按钮，回底恢复；折叠 turn header 增加摘要徽章（事件计数 + `+n/-m`，`useMemo` 按 `group.events` 缓存）；以 component tests 验证三条行为。
- [x] 5.3 [P1, depends: 5.1, 5.2] 同步 10 个 locale 新增 key（回到底部、摘要徽章等），保持 key parity。

## 6. Focused Verification

- [x] 6.1 [P0, depends: 1.1-5.3] 运行 session-activity、quick-switcher、titlebar 相关 focused Vitest suites 与 locale parity 检查；不运行全量测试。
- [x] 6.2 [P0, depends: 6.1] 运行 touched-file targeted ESLint、项目 typecheck 与 `openspec validate enhance-session-activity-panels --strict --no-interactive`，记录结果与任何既有无关失败。
- [x] 6.3 [P0, depends: 6.2] 完成 diff 审计，确认只包含本 change 文件；保留 manual desktop visual QA 为用户最终验收项，**不提交 commit、不 archive**。

## 7. Review 修复（2026-07-24 评审后）

- [x] 7.1 B1 reconcile 删除复活修复：`deleteSessionRadarHistoryEntries` 的 cutoff 覆盖 persisted completedAt / persisted updatedAt / 调用方 live updatedAt / 既有 cutoff 四方；`SessionRadarHistoryDeleteTarget` 新增可选 `liveUpdatedAt` 字段并在收尾闭环——`WorkspaceSessionRadarPanel` 与 `SettingsView` 两处调用点删除时传 `liveUpdatedAt: entry.updatedAt`（UI entry 的 updatedAt 已是 live 刷新值），消除「thread 刚更新、feed 未回写、用户立即删除」的复活窗口；补 panel 行为测试与 reconcile 复活回归测试。
- [x] 7.2 B2 `window.confirm` → `ConfirmDialog`：Radar 日期组整组删除改走自建 `ConfirmDialog`（WKWebView 下 `window.confirm` 静默返回 false），补取消/确认双分支测试。
- [x] 7.3 dismissed TTL 惰性清理：早于 `now - RADAR_RECENT_TTL_MS` 的陈旧 dismissed cutoff 在读取点（`readDismissedCompletedAtById`）做内存惰性过滤，纯 TTL 过滤不保证落盘；dismissed store 的写回仅随两条路径触发——feed merge 存在 `prunedEntryIds`（bounds 物理修剪）时同步清除对应死数据，以及删除路径（`sessionRadarHistoryManagement`）的 bounds 修剪联动；用户主动删除的 cutoff 保留以防复活。
- [x] 7.4 删除写盘顺序：先落 dismissed cutoff 再落 recent，消除崩溃窗口期的复活风险（writeOrder 契约测试守护）。
- [x] 7.5 reconcile 活动证据门槛：补写完成记录需具备活动证据，避免无证据 thread 被误补。
- [x] 7.6 `renderTurnArtifacts` 缓存：折叠 turn header 摘要渲染结果按 `group.events` `useMemo` 缓存。
- [x] 7.7 setState updater 副作用清理：删除流程的 updater 内不再掺杂写盘等副作用。
- [x] 7.8 顶栏徽章 aria：收起态 running 计数徽章补全 aria-label / 语义属性。
- [x] 7.9 QS reduced-motion：quick-switcher live pulse 动画尊重 `prefers-reduced-motion`。
- [x] 7.10 `startedAt` nullable：类型与消费方允许空值，去掉非空假设。
- [x] 7.11 契约/行为测试补齐：writeOrder、persistence、reconcile、incremental、parity 等 focused suites 全绿。
