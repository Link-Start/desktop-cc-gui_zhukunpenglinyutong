## Why

对 `最近活动` 模块（Radar 面板 + 会话内 Activity 时间线 + Quick Switcher 快速导航）的集中代码审查发现一组用户可感知的欠缺与慢性劣化问题：

- **Radar 可感知性违约**：右侧面板收起后 running 会话的 live 提示完全不可见，违背既有 spec「Radar Entry Signal SHALL Remain Discoverable When Panel Is Collapsed」的场景承诺。
- **Radar 交互不一致**：最新日期组默认折叠、未读条目无法删除、删除失败静默、整天删除无确认、readState 不响应外部历史管理变更。
- **持久化无界增长**：`sessionRadar.recentCompleted`（store `leida`）无上限无 TTL，`dismissedCompletedAtById` 与 `collapsedDateGroups` 只增不减，每次变更全量 immediate 写盘，随使用时间慢性劣化。
- **完成记录丢失**：已完成会话仅由内存中 `isProcessing true→false` 跳变检测产生，应用启动前已完成或启动瞬间完成的会话永远不进「最近完成」。
- **Quick Switcher 导航委托契约守护**：`spec` / `intentCanvas` / `projectMap` 三个导航项在 runtime 已由 wrapper（`useAppShellLayoutNodesSection`）接通 canonical open actions，base handler 的空 case 属 shadowed 兜底；需要为该 wrapper 委托契约补充注释与测试守护，防止 spread 顺序调整导致静默退化。
- **Activity 时间线无障碍与体验缺口**：diff 预览模态框无 Escape/焦点管理、tablist 声明 ARIA 语义但不支持方向键、follow 气泡 1 秒自动消失且永久 dismiss、reasoning 自动滚底劫持用户滚动、折叠 turn 无摘要不可扫读。

## 目标与边界

- 修复 Radar 面板交互一致性问题，保持现有 visual language 与数据结构兼容。
- 为 Radar 持久化增加容量上限、TTL 与关联状态修剪，旧数据无损迁移（惰性修剪）。
- 在启动/加载路径补偿遗漏的完成记录，不回源 `thread.updatedAt` 造成已删除历史复活。
- 为 Quick Switcher 三个导航项（`spec` / `intentCanvas` / `projectMap`）的 wrapper 委托契约补充注释与测试守护，复用既有 canonical open actions，不新增入口、不改变面板结构。
- 右侧面板收起时在展开 affordance 上提供 running 会话可感知信号，不自动展开面板、不新增轮询。
- Activity 时间线补齐键盘/焦点无障碍与滚动跟随体验，不改变事件模型与 adapter 数据流。

## 非目标

- 不统一 Quick Switcher「最近会话」与 Radar「最近完成」两套数据源（中期架构议题，另行立项）。
- 不重构 `occurredAt` 合成时间戳语义、不引入列表虚拟化、不做渲染性能优化（需先按 `docs/perf/render-jank-knife-experiments-2026-07-08.md` 重新测量）。
- 不删除或接通 Sidebar 的 radar 计数死 props 链（跨 5 层 wiring，另案评估）。
- 不扩展 `SessionActivityKind` 活动类型覆盖面（Git/终端第一公民入口另案）。
- 不提交 git commit；实现完成后由用户验收。

## What Changes

- **Radar 面板 UX**：最新日期组默认展开；未读条目同样展示删除操作；单条/日期组删除失败时展示可恢复错误提示；日期组删除前二次确认；面板订阅 `SESSION_RADAR_HISTORY_UPDATED_EVENT` 同步 readState 与分组折叠态。
- **Radar 持久化治理**：`recentCompleted` 设每 workspace 上限 50 / 全局上限 200 + 30 天 TTL；修剪物理条目时同步清理 `dismissedCompletedAtById` 中不存在的 id；收敛 `RADAR_STORE_NAME` 等重复常量。
- **完成记录补偿**：radar feed 在 threads 加载后对比 `thread.updatedAt` 与已持久化 `completedAt`，把遗漏的完成补写入 store；受 dismissed cutoff 保护，不复活已删除历史。
- **Quick Switcher 委托契约守护**：`spec` / `intentCanvas` / `projectMap` 导航项在 runtime 已由 `useAppShellLayoutNodesSection` 的 wrapper 接通 canonical actions（base 空 case 为 shadowed 兜底）；本次为其补充注释与 wiring 守护测试，防止 spread 顺序调整导致静默退化，无行为变更。
- **收起态 live 信号**：右侧面板收起时，在展开 affordance 上叠加 running 会话计数徽章；数据复用现有 `sessionRadarFeed`，不新增订阅或定时器。
- **Activity 时间线无障碍与跟随体验**：diff 预览模态框支持 Escape 关闭（脏状态走既有 `UnsavedChangesDialog`）与焦点管理；主/子 tablist 支持方向键导航；follow coach 气泡自动消失时间延长且自动消失不再写入永久 dismiss；reasoning 自动跟随在用户上滚时暂停并提供回到底部入口；折叠 turn header 增加事件/文件变更摘要徽章。

## 技术方案对比

### 方案 A：分领域最小修复，逐文件收敛（采用）

- 每个问题在所属 feature 文件内闭环修复，持久化治理放在 `sessionRadarPersistence.ts` / `useSessionRadarFeed.ts`，UI 修复放在各自 Panel 组件。
- 优点：边界清晰、review 粒度小、不触碰 adapter 事件模型与渲染红线；缺点：跨面板重复逻辑（如 `parsePersistedRadarRecentEntry`）只做低风险收敛，不追求彻底统一。

### 方案 B：统一 Radar / Quick Switcher 数据源后再修 UX（不采用）

- 优点：消除两套「最近会话」；缺点：改动面横跨 app-shell 根链，违反本变更「不动渲染红线与数据流」的约束，且无法在本迭代内安全验收。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`: Radar 交互一致性、持久化边界、完成记录补偿、收起态 live 信号、时间线无障碍与跟随体验。
- `quick-context-switcher`: 快速导航 wrapper 委托契约守护（注释 + 测试）。

## 验收标准

- 右侧面板收起且存在 running 会话时，用户无需展开面板即可看到可识别的计数信号；展开后既有 live 提示不变。
- Radar 最新日期组默认展开；未读条目可删除；删除失败有可见错误反馈；日期组删除有确认；设置页历史管理操作后面板未读态即时同步。
- `leida` store 的 recentCompleted 不超过全局上限与 TTL；删除条目后 dismissed map 无残留死数据；旧版本写入的超限/过期数据在下次 merge 时被惰性修剪。
- 启动前已完成的会话在面板打开后能出现在「最近完成」；已被用户删除的完成记录不复活。
- Quick Switcher 三个导航项点击后执行与对应模块入口一致的 canonical action，无空响应。
- diff 预览模态框可 Escape 关闭且有焦点管理；tablist 支持方向键；follow 气泡自动消失后同 workspace 仍可再次触发 coach；reasoning 流式期间用户上滚不被拉回底部；折叠 turn header 可见摘要徽章。
- 相关 focused Vitest、targeted lint/typecheck 与 `openspec validate enhance-session-activity-panels --strict --no-interactive` 通过。

## Impact

- Frontend：`src/features/session-activity/**`（Radar panel、feed hook、persistence、history management、Activity panel）、`src/features/quick-switcher/**`、`src/app-shell-parts/useAppShellQuickSwitcherSection.ts`、`src/app-shell-parts/useAppShellSearchRadarSection.ts`、titlebar/layout 展开 affordance 组件、i18n locales（新增/修改文案 key）。
- Storage：复用现有 `leida` client store；仅增加 merge 时的修剪逻辑，无 schema migration，无 backend command 变更。
- Dependencies：无新增 dependency。
