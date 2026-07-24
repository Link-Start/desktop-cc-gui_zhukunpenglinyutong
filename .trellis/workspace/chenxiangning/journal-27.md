# Journal - chenxiangning (Part 27)

> Continuation from `journal-26.md` (archived at ~2000 lines)
> Started: 2026-07-24

---



## Session 1084: 增强最近活动面板与快速切换器交互

**Date**: 2026-07-24
**Task**: 增强最近活动面板与快速切换器交互
**Branch**: `feature/v-078`

### Summary

三个 OpenSpec change（session-activity-panels / quick-switcher-hub / nav-toggle）实现、双轮 review 修复、用户验收后归档并同步 main specs：Radar 持久化边界与完成补偿、收起态顶栏徽章、⌘E 进行中 live 区与新入口、导航回切与无效提示、首页遮挡修复。

### Main Changes

### Main Changes

三个 OpenSpec change 全部实现、验收并归档，spec delta 已同步 main specs：

| Change | 内容 |
|---|---|
| `enhance-session-activity-panels` | Radar 持久化边界（30 天 TTL / 每 workspace 50 / 全局 200 惰性修剪）、完成记录 reconcile（启动前完成补记 + 删除防复活闭环）、收起态顶栏 running 计数徽章、Radar 交互一致性（最新日期组默认展开/未读可删/删除失败反馈/ConfirmDialog 二次确认/外部事件同步）、Activity 时间线无障碍（diff modal Escape+焦点、tablist 方向键、follow 气泡 8s 且自动消失不永久 suppress、reasoning 上滚暂停跟随、折叠 turn 摘要徽章） |
| `enhance-quick-switcher-hub` | ⌘E 面板会话栏顶部「进行中」live 区（绿色脉冲、跨 workspace 跳转、与最近会话去重）、新增全局搜索/便签/项目记忆导航入口（初版新建会话与帮助文档经用户验收后移除） |
| `enhance-quick-switcher-nav-toggle` | 快速导航回切语义（开→点→关，10 个 in-shell 入口）、当前模块 is-active 高亮、无工作区 info toast 提示（替代静默空默认页与 intentCanvas 的 window.alert）、Quick Switcher 全部激活路径统一关闭首页表面（修复 home 遮罩后无反馈 bug） |

Review 治理：6 路并行 code review 发现的 2 个 BLOCKER（reconcile 删除复活、macOS WKWebView window.confirm 静默失效）与 9 项 SHOULD_FIX 全部修复；用户自审发现的 4 个 artifact 问题（globalSearch 不可达回切 spec 排除、changes/README 索引、死项错误归因、dismissed TTL 表述）同步修正。

**关键文件**：
- `src/features/session-activity/**`、`src/features/quick-switcher/**`、`src/app-shell-parts/quickSwitcherNavigationState.ts`（新增纯函数路由判定）
- `src/components/ui/ConfirmDialog.tsx`（新增通用组件）
- `src/features/app/components/MainHeader.tsx`、`src/app-shell-parts/useAppShell{QuickSwitcher,LayoutNodes,SearchRadar,SearchAndComposer}Section.*`
- `openspec/changes/archive/2026-07-23-enhance-*`（三个归档 change）

### Testing

- [OK] focused Vitest：65 files / 539 tests 全部通过（最终集成批），后续修复批 quick-switcher + shell 70/70
- [OK] targeted ESLint 0 告警；`tsc --noEmit` 干净
- [OK] 三个 change `openspec validate --strict` 通过；归档后全量 442/443（1 项失败为既有无关 change `fix-claude-cli-native-installer` 的 spec 格式问题，本次未触碰）
- [OK] i18n 十语言 parity 脚本验证通过；diff 审计无域外文件
- [OK] 用户桌面视觉验收通过；按约定未运行全量测试


### Git Commits

| Hash | Message |
|------|---------|
| `c18a3a694` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1085: OpenSpec 批量归档 19 个已验证提案

**Date**: 2026-07-24
**Task**: OpenSpec 批量归档 19 个已验证提案
**Branch**: `feature/v-078`

### Summary

openspec-bulk-archive-change:19 个 verified change 按时间序归档并合并 delta specs 到主 specs(新增 8 个 capability);修复 2 个 delta 缺陷(cli-native-installer 缺 requirement 正文、file-history MODIFIED 校正为 ADDED);冲突组 git-history-panel/git-pr-submission-workflow/git-panel-diff-view/file-history-view 按旧→新合并;同步更新 project.md、changes/README.md、archive/README.md 计数与索引(archive 713 / specs 429 / active 4);修复 3 处 Trellis 归档 PRD 失效路径。validate --all --strict:433 passed。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `af472a2c4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1086: 清理未使用客户端模块

**Date**: 2026-07-24
**Task**: 清理未使用客户端模块
**Branch**: `feature/v-078`

### Summary

删除 legacy ComposerInput、parallel orphan module 与未接线 search workspace indexing layer；同步 large-file JSON/Markdown baseline；归档并索引 3 个 OpenSpec change。验证 lint、typecheck、902 个 test files、OpenSpec strict validation 433 项通过；large-file gate 仍受仓库既有 baseline debt 阻塞，与本变更无关。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d1a90dddd7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1087: 移除 Project Map 编排中心 S1-S4

**Date**: 2026-07-24
**Task**: 移除 Project Map 编排中心 S1-S4
**Branch**: `feature/v-078`

### Summary

迁移 TaskRun 事件总线，断开 app-shell/layout 引用，删除编排中心本体、i18n 与 CSS；G4 typecheck、lint、889 个 test files 全绿。

### Main Changes

OpenSpec change: remove-project-map-orchestration-center

已完成：
- S1：迁移 ccgui:open-task-run 事件总线至 tasks 模块。
- S2：移除 app-shell 编排派发回调。
- S3：移除 layout、Project Map 与 Task Center 的编排入口和装配。
- S4：删除 agent-orchestration 目录、10 语言包、locale keys 与编排中心样式。
- 补充清理 scrollbars.css 中 8 处残余 selector。
- 修正 appShellLazyBoundaries.test.ts 的等价 Project Map lazy-mount 符号断言。

验证：
- npm run typecheck：通过。
- npm run lint：通过。
- npm run test：889/889 test files 通过。
- runtime source 禁用符号扫描：零命中。
- src/features/messages/orchestration/：16 个文件完整保留。

后续：执行 S5 main spec 删除、OpenSpec strict validate、smoke、verification、sync/archive。


### Git Commits

| Hash | Message |
|------|---------|
| `929acbd75` | (see git log) |
| `b83efeb9b` | (see git log) |
| `fdf925f98` | (see git log) |
| `49fdb2b4f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1088: 移除并归档 Project Map 编排中心

**Date**: 2026-07-24
**Task**: 移除并归档 Project Map 编排中心
**Branch**: `feature/v-078`

### Summary

迁移 TaskRun 导航事件总线，移除 app-shell 与 layout 编排接线、编排中心模块及资产；保留 Kanban、Project Map 与幕布关联运行链路。完成 typecheck、lint、889/889 test files、OpenSpec strict validation、人工冷启动/Kanban/Project Map/banner smoke，并同步删除 main spec 后归档 change。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `929acbd75` | (see git log) |
| `b83efeb9b` | (see git log) |
| `fdf925f98` | (see git log) |
| `49fdb2b4f` | (see git log) |
| `165758fe8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1089: P0-4 openspec specs 索引补登与计数校准

**Date**: 2026-07-24
**Task**: P0-4 openspec specs 索引补登与计数校准
**Branch**: `feature/v-078`

### Summary

补登 26 个未索引 capability 至 openspec/specs/README.md(403→429),同步校准 config.yaml/openspec/README/changes/README/project.md 计数(Active 4 / Archived 717);openspec validate specs 全绿,2 个失败为并行代理未跟踪 change;typecheck 通过

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0a723b7ec` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1090: 修复引擎二元假设并收敛 isValidModelId 校验

**Date**: 2026-07-24
**Task**: 修复引擎二元假设并收敛 isValidModelId 校验
**Branch**: `feature/v-078`

### Summary

OpenSpec change fix-engine-attribution-and-model-id-validation:EngineTaskOutputEngine 放宽为 EngineType 并显式 normalize unknown 值;useStatusPanelData/StatusPanel/useLayoutNodes 透传真实引擎;vendors/types.ts 的 isValidModelId/MODEL_ID_PATTERN 收敛为 composer/types/provider 单一实现(≤128 + pattern)。typecheck/eslint/focused vitest 全部通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `38e139b37` | (see git log) |
| `bfb61b9e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1091: SettingsView 摘除 ts-nocheck 并清理 skills 死分支

**Date**: 2026-07-24
**Task**: P0-3 SettingsView.tsx 摘 @ts-nocheck + 删 skills 死分支
**Branch**: `feature/v-078`

### Summary

OpenSpec change remove-settings-view-ts-nocheck-and-skills-dead-branch(已归档为 2026-07-24-remove-settings-view-ts-nocheck-and-skills-dead-branch):删除 SettingsView.tsx 中恒为 false 的 `activeSection === "skills"` 不可达分支(curated skills 已迁至 MCP skills subtab),修复残余 5 个 TS6133 unused import 报错(ChevronDown/ChevronUp/Trash2/getDefaultInterruptShortcut/SessionRadarHistoryDeleteResult),最终摘除第 1 行 `// @ts-nocheck`。新 capability `settings-view-type-safety` 已同步主 specs。

### Main Changes

- src/features/settings/components/SettingsView.tsx:删死分支 14 行、清理 5 个 unused import、摘 @ts-nocheck(唯一改动的代码文件)
- openspec:新增并归档 change;新增 openspec/specs/settings-view-type-safety/spec.md

### Git Commits

| Hash | Message |
|------|---------|
| `71ab03f58` | docs(openspec): 新增提案 |
| `29ef72543` | refactor(settings): 删除不可达 skills 死分支 |
| `37d545f4f` | fix(settings): 清理未使用 import 修复残余 tsc 报错 |
| `b1a2ea4a5` | refactor(settings): 摘除 ts-nocheck |
| `27ab8b906` | chore(openspec): 同步主规范并归档 |

### Testing

- [OK] `npm run typecheck`(tsc --noEmit)exit 0
- [OK] `npx eslint src/features/settings/components/SettingsView.tsx` 通过
- [OK] `npx vitest run src/features/settings/components/SettingsView.test.tsx` 52/52 通过
- [OK] `openspec validate --all --strict` 434/434 通过

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1092: P0-1 settings 加载失败静默修复（损坏隔离备份 + 前端可见提示）

**Date**: 2026-07-24
**Task**: P0-1 settings 加载失败静默修复（损坏隔离备份 + 前端可见提示）
**Branch**: `feature/v-078`

### Summary

OpenSpec change preserve-corrupted-app-settings-on-load 已归档并同步主 spec app-settings-corruption-recovery：后端 read_settings 失败时先将 settings.json 隔离备份为 .corrupted-<UTC ts>.bak 再回退默认值（GUI state.rs 与 daemon daemon_state.rs 两处 unwrap_or_default 调用点），防止后续保存覆盖写回导致用户设置不可逆丢失；前端 useAppSettings 加载 catch 补 console.error 与 pushErrorToast 用户可见提示。typecheck/eslint/focused Vitest 30/30/cargo storage 26/26/daemon_state 9/9/openspec strict 全部通过。

### Main Changes

### Main Changes

- `src-tauri/src/storage.rs`：新增 `backup_corrupted_settings_file(path, error)`（rename 为 `settings.json.corrupted-%Y%m%dT%H%M%SZ.bak` + `[storage]` 日志）与两个单测；`read_settings` 函数体未动。
- `src-tauri/src/state.rs` 与 `src-tauri/src/bin/cc_gui_daemon/daemon_state.rs`：两处 `unwrap_or_default()` 改 `unwrap_or_else`，失败先备份再回退 `AppSettings::default()`；`load()` 其他初始化语句未触碰。
- `src/features/settings/hooks/useAppSettings.ts`：加载 catch 补 `console.error` + `pushErrorToast`（复用 `services/toasts`，`i18n.t(..., { defaultValue })` 带兜底，未新增 locale key）。
- `useAppSettings.test.ts`：新增 reject 用例（defaults 保持、isLoading 收敛、toast 恰好一次）。
- OpenSpec：`openspec/changes/archive/2026-07-24-preserve-corrupted-app-settings-on-load/` + `openspec/specs/app-settings-corruption-recovery/spec.md`；changes/README 与 archive/README 索引同步。

### Testing

- [OK] `npm run typecheck` exit 0（期间其他代理未提交的 SettingsView.tsx 报错与本 change 无关，其修复后全量通过）
- [OK] `npx eslint`（2 个改动文件）无告警
- [OK] `npx vitest run src/features/settings/hooks/useAppSettings.test.ts` 30/30（含 legacy Gemini 归一不回归）
- [OK] `cargo test --lib storage` 26/26；`cargo test --bin cc_gui_daemon daemon_state` 9/9；`cargo check --bins` 通过
- [OK] `openspec validate --specs --strict --no-interactive` 430/430

### 邻近发现（未修复）

- `read_workspaces(...).unwrap_or_default()`（state.rs 与 daemon_state.rs）对 workspaces.json 存在同类静默回退 + 覆盖写回风险。
- 并行代理归档的 settings-view-type-safety 尚未补登 archive/README 索引（其负责方跟进）。


### Git Commits

| Hash | Message |
|------|---------|
| `a1dd0795b` | (see git log) |
| `c3d472a34` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1093: settings 损坏恢复通知链路打通（后端 recovery notice + 前端 toast + i18n）

**Date**: 2026-07-24
**Task**: settings 损坏恢复通知链路打通（后端 recovery notice + 前端 toast + i18n）
**Branch**: `feature/v-078`

### Summary

OpenSpec notify-settings-recovery-after-corruption 已归档：quarantine 记录一次性 recovery notice，take_settings_recovery_notice command 暴露给前端，加载成功后弹一次本地化 toast，i18n key 补 zh/en

### Main Changes

### Summary

OpenSpec change notify-settings-recovery-after-corruption 已归档并同步主 spec `app-settings-corruption-recovery`，打通"后端 quarantine → 前端用户可见提示"链路，修复上一轮 review 缺口：quarantine 发生在启动期，之后 `get_app_settings` 从内存态直接返回 `Ok(默认值)`，真实损坏场景下前端 catch 分支的 toast 永远不会弹。本次后端在 `AppState` 记录一次性 recovery notice（含备份文件名），新增 `take_settings_recovery_notice` command（take 语义：读取即清除）；前端 `useAppSettings` 加载成功路径调用一次，有 notice 弹一次本地化 toast；5 个 i18n key 补进 zh/en locale（其余语言走 en fallback）；修正 catch 分支文案，删除"后端已备份为 .bak"的错位表述。

### Main Changes

- `src-tauri/src/storage.rs`：`backup_corrupted_settings_file` 返回值改 `Option<PathBuf>`（rename 成功返回备份路径），quarantine 逻辑不变；两个既有单测适配并断言返回路径。
- `src-tauri/src/shared/settings_core.rs`：新增 `SettingsRecoveryNotice`（camelCase serialize，`backup_file_name: Option<String>`）与 `take_settings_recovery_notice_core`（take 语义）；新增 take-once-clears / empty 两个单测。
- `src-tauri/src/state.rs`：`AppState` 新增 `settings_recovery_notice` 字段，`load` 的 quarantine 分支记录 notice；`settings/mod.rs` 新增 command；`command_registry.rs` 注册；`daemon_state.rs` 仅 `let _ =` 适配签名（daemon 无 UI，行为不变）；两处 git 测试的 `AppState` 字面量构造补新字段。
- `src/services/tauri/settings.ts` + barrel：新增 `SettingsRecoveryNotice` 类型与 `takeSettingsRecoveryNotice`。
- `useAppSettings.ts`：成功路径独立 try/catch 拉取 notice（失败不影响加载），有 notice 弹一次 toast；catch 分支文案改为只描述读取失败。
- `src/i18n/locales/zh/settings.ts` / `en/settings.ts`：补 `settingsRecoveredTitle/Message/NoBackupMessage` 与 `appSettingsLoadFailedTitle/Message` 共 5 个 key。
- `useAppSettings.test.ts`：mock 增加 take command，新增 3 个用例 + 扩展 catch 用例（不含 .bak、不调用 take command）。
- OpenSpec：`openspec/changes/archive/2026-07-24-notify-settings-recovery-after-corruption/` + 主 spec MODIFIED 1 条 / ADDED 2 条；archive/README 补条目 + Indexed 719→720；changes/README 补归档条目。

### Testing

- [OK] `npm run typecheck` 通过
- [OK] `npx eslint`（8 个改动前端文件）无告警
- [OK] `npx vitest run useAppSettings.test.ts` 34/34
- [OK] 间接消费方回归：app-shell.startup / DetachedSpecHubWindow / DetachedFileExplorerWindow / ClientDocumentationWindow 25/25
- [OK] `cargo test --lib` 1535 通过；`cargo test --bin cc_gui_daemon` 948 通过
- [OK] `openspec validate --specs --strict --no-interactive` 430/430

### 预存问题（非本次引入，仅记录）

- `runtime::tests::replace_workspace_session_with_source_marks_old_session_shutdown_source` 与 `runtime::tests::replacement_waiter_does_not_swap_in_a_third_runtime` 在 lib 与 daemon bin 均失败；`git stash` 后干净树复跑同样失败，确认预存，与本次改动无关。

### Status

[OK] **Completed**

### Next Steps

- None - task complete


### Git Commits

| Hash | Message |
|------|---------|
| `ae0927a17` | (see git log) |
| `615733516` | (see git log) |
| `9c395fa2d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1094: OpenSpec 索引终态校准

**Date**: 2026-07-24
**Task**: OpenSpec 索引终态校准
**Branch**: `feature/v-078`

### Summary

(Add summary)

### Main Changes

任务目标:对 2026-07-24 并行归档造成的 openspec 索引漂移做终态校准(纯文档,单 commit 闭环,参照 0a723b7ec 先例)。

主要改动:
- openspec/specs/README.md: 删除 agent-task-orchestration-center 索引死链(spec 已由 165758fe8 移除,空目录本 checkout 已不存在),按字母序补登 app-settings-corruption-recovery(A 组)与 settings-view-type-safety(S 组),计数 429 → 430
- openspec/changes/archive/README.md: 补登 45 条 2026-07-18~24 漏登归档条目(07-18×2、07-19×2 新建分组、07-20×2、07-21×17 新建分组、07-22×14、07-23×7、07-24×1),Indexed proposals 720 → 721,2026-07 月度分组 142 → 188(基线预存漂移一并修);其余月度组账实相符未动
- openspec/specs/app-settings-corruption-recovery/spec.md 与 settings-view-type-safety/spec.md: TBD Purpose 占位符补写为真实 Purpose(依据各自归档 proposal)
- openspec/README.md / config.yaml / project.md / changes/README.md: 统一 active=4 / archived=721 / specs=430;project.md 修复 Current workspace state(717/429) 与 Current Inventory(713/429) 两处自相矛盾,Updated At  bump 至 2026-07-24,追加 Update History 条目

验证结果:
- specs 索引=spec.md 文件=目录=430,diff 为空;archive 索引=目录=721,diff 为空,无死链;六个月度分组账实全部相符;active 列表与 changes/ 实际 4 目录一致
- openspec validate --all --strict --no-interactive: 434 passed, 0 failed
- npm run typecheck: 通过(纯文档无影响)

遗留问题:
- 全仓库约 120 个 spec.md 的 Purpose 仍是归档模板 TBD 占位符(预存系统性问题,本次只修了两个新登记 spec)
- openspec/changes/README.md 的 2026-07-24 批次描述行"23 个 verified proposal"为 prose 摘要(当日实际 27 个归档),不在三计数口径内未改
- 工作区未跟踪文件 docs/reports/p0-reprioritized-decision-board-2026-07-24.md 属其他代理,未动


### Git Commits

| Hash | Message |
|------|---------|
| `6bb5fc5f0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1095: P0 治理:修复 quarantine 前端通知缺口与 openspec 索引终态校准,更新决策看板

**Date**: 2026-07-24
**Task**: P0 治理:修复 quarantine 前端通知缺口与 openspec 索引终态校准,更新决策看板
**Branch**: `feature/v-078`

### Summary

review 后修复:P0-1 主场景不闭环(quarantine→take_settings_recovery_notice→前端 toast,zh/en i18n 补齐,已归档 notify-settings-recovery-after-corruption);openspec 索引终态校准(430 specs/721 archived/4 active,补登 45 条预存漏登,6bb5fc5f0);决策看板文档更新并入库

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ae0927a17` | (see git log) |
| `615733516` | (see git log) |
| `9c395fa2d` | (see git log) |
| `6bb5fc5f0` | (see git log) |
| `db9d01978` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1096: 删除 orchestration 残留死字段

**Date**: 2026-07-24
**Task**: 删除 orchestration 残留死字段
**Branch**: `feature/v-799`

### Summary

OpenSpec change remove-orchestration-residual-dead-fields：删除 TaskRun 域 orchestration 残留死字段与死分支（types.ts source union/orchestrationTaskId、taskRunStorage normalize/create 分支、taskRunCoordinator 透传），清理覆盖死代码的测试；typecheck/eslint/tasks 全域 vitest 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `35c44d292` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1097: 删除 SettingsView 恒 false 入口开关与死分支

**Date**: 2026-07-24
**Task**: 删除 SettingsView 恒 false 入口开关与死分支
**Branch**: `feature/v-799`

### Summary

OpenSpec change remove-settings-view-dead-entry-switches：删除 settingsViewConstants.ts 中 5 个恒 false 的 SHOW_*_ENTRY feature flag（7 行），删除 SettingsView.tsx 中对应 import、5 个仅死分支使用的 icon import（GitCommitHorizontal/FileText/Mic/GitBranch/FlaskConical）及 5 段恒 false JSX 分支（69 行），共删 76 行。typecheck/eslint/SettingsView vitest（52 项）均通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `44a32c392` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1098: 接线语义 diff AI review 按需生产者 (add-ai-review-producer-wiring)

**Date**: 2026-07-24
**Task**: 接线语义 diff AI review 按需生产者 (add-ai-review-producer-wiring)
**Branch**: `feature/v-799`

### Summary

新增 turnSemanticReview utils(prompt 构建/解析校验/引擎调用)与 useTurnSemanticReview hook(semantic tab 按需触发 + per-turn cache + 失败静默降级),接线 WorkspaceSessionActivityPanel;24 focused tests + 67 panel 回归全过,typecheck/eslint/openspec validate 通过

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `053cfbc04` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1099: 删除响应式布局死分支 (remove-responsive-layout-dead-branches)

**Date**: 2026-07-24
**Task**: 删除响应式布局死分支 (remove-responsive-layout-dead-branches)
**Branch**: `feature/v-799`

### Summary

删除硬编码 desktop 的 useLayoutMode 与永远走不到的 PhoneLayout/TabletLayout(-317 行);AppLayout/useLayoutController/renderAppShell 内联恒 false 常量。验证:typecheck 0 error,eslint 0 problem,vitest 23/23。注意:改动被并行代理的整 index commit d723d5d4a(chore(trellis))捎带提交,消息与内容不符,待归档官修复历史。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d723d5d4a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1100: 删除 dock streaming 死分支

**Date**: 2026-07-24
**Task**: 删除 dock streaming 死分支
**Branch**: `feature/v-799`

### Summary

OpenSpec remove-dock-streaming-dead-branch：删除 useGlobalRuntimeNoticeDock 的 streaming 死分支（常量/类型成员/resolve 死函数）、组件 label 与指示器分支、10 locale + vitest.setup 的 statusStreaming 键；附 global-runtime-notice-dock spec delta（MODIFIED 两处 requirement，记录 2026-06-05 c585cc147 error-only 简化）。typecheck/eslint/vitest(19) 全绿。--no-commit 避免吞并并行代理 staged 变更。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f91ab9a4a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1101: 删除 latestAgentRuns 死链与 refreshCodexModelConfig 透传层

**Date**: 2026-07-24
**Task**: 删除 latestAgentRuns 死链与 refreshCodexModelConfig 透传层
**Branch**: `feature/v-799`

### Summary

两个 OpenSpec change：remove-latest-agent-runs-dead-chain（删除 ~319 行死链：latestAgentRuns.ts+测试 202 行、app-shell 根层两个 useMemo 与 domain context 下传、layoutNodes 链、Home/HomeChat 死 props、四处测试同步）与 inline-refresh-codex-model-config-passthrough（删除 9 行纯透传 helper+测试，内联进 useModelConfigRefresh codex 分支，清理 startup test mock，commit cdf30cffc）。typecheck/eslint/相关 vitest（176 tests）全绿。未执行 archive，未改全局索引。

### Main Changes

OpenSpec changes: remove-latest-agent-runs-dead-chain, inline-refresh-codex-model-config-passthrough
Commits: 651b8d5e0 refactor(app-shell): 删除 latestAgentRuns 首页死链; cdf30cffc refactor(models): 内联 refreshCodexModelConfig 透传层
Deleted: src/app-shell-parts/latestAgentRuns.ts (98), src/app-shell-parts/latestAgentRuns.test.ts (104), src/features/models/refreshCodexModelConfig.ts (9), src/features/models/refreshCodexModelConfig.test.ts (26)
Modified: src/app-shell.tsx, src/app-shell-parts/appShellDomainContexts.ts, src/app-shell-parts/useAppShellLayoutNodesSection.tsx, src/app-shell-parts/useModelConfigRefresh.ts, src/app-shell.startup.test.tsx, src/features/layout/hooks/{useLayoutNodes.tsx,layoutNodesTypes.ts,useLayoutNodes.client-ui-visibility.test.tsx}, src/features/home/components/{Home.tsx,HomeChat.tsx,Home.test.tsx,HomeChat.test.tsx,HomeChat.interactions.test.tsx}
Verification: npm run typecheck PASS; npx eslint on changed files PASS; vitest home+app-shell-parts (87), layout hooks (87), app-shell.startup (9) all PASS.
Note: 中间 6eca222b3 为并行代理的 trellis 记录提交；未执行 archive，全局索引文件未动。


### Git Commits

| Hash | Message |
|------|---------|
| `651b8d5e0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1102: 移除 JCEF bridge no-op 桩与死链调用点 (remove-jcef-bridge-noop-stubs)

**Date**: 2026-07-24
**Task**: 移除 JCEF bridge no-op 桩与死链调用点 (remove-jcef-bridge-noop-stubs)
**Branch**: `feature/v-799`

### Summary

删除 composer/utils/bridge.ts(73 行全 no-op)与 providers/createBridgeProvider.ts(231 行零引用);清理 slashCommandProvider/promptProvider 的 sendBridgeEvent 死路与 window.updateSlashCommands 注册,移除 useInputHistory 7 处 sendToJava 死写;测试改用 __pendingSlashCommands 注入。typecheck/eslint/vitest(44+545)全绿。注意:并行代理竞态导致 7 个文件被卷入 e20e5d147,删除操作独立提交于 51ecca64a。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e20e5d147` | (see git log) |
| `51ecca64a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1103: 归档 8 个并行清理 change 并提交 layout 死分支删除

**Date**: 2026-07-24
**Task**: 归档 8 个并行清理 change 并提交 layout 死分支删除
**Branch**: `feature/v-799`

### Summary

提交 remove-responsive-layout-dead-branches 成果（删除 Phone/Tablet 布局与 useLayoutMode）；openspec archive 8 个 change，同步 global-runtime-notice-dock 与 git-panel-diff-view 主 spec；索引计数校准 archive 721→729、2026-07 组 188→196；strict 校验与 typecheck 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `43b6e8187` | (see git log) |
| `ba0e0a6d5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1104: 修复 workspaces.json 损坏静默回退与覆盖写回风险并完成 OpenSpec 闭环

**Date**: 2026-07-25
**Task**: 修复 workspaces.json 损坏静默回退与覆盖写回风险并完成 OpenSpec 闭环
**Branch**: `feature/v-799`

### Summary

复用 settings 修复模式:泛化 backup_corrupted_file 先隔离备份损坏 workspaces.json 再回退空列表(GUI/daemon 两处);平行新增 WorkspacesRecoveryNotice 与 take_workspaces_recovery_notice 命令;useWorkspaces 挂载后弹一次本地化 toast(zh/en 补 key)。验证:typecheck/eslint/Vitest 49 通过,cargo lib 1538+daemon 951 通过(runtime::tests 2 个沙箱预存失败除外)。OpenSpec change preserve-corrupted-workspaces-on-load-and-notify 已归档,新主 spec workspaces-corruption-recovery 已同步,索引计数按实测补登(active=4/archive=730/specs=431),全量 strict 仅预存 add-tokentracker-usage-dashboard 失败。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `42aac995f` | (see git log) |
| `d51c7dee0` | (see git log) |
| `d87d62165` | (see git log) |
| `9cdd61c15` | (see git log) |
| `41ca6300e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1105: 收口清理波次遗留链路

**Date**: 2026-07-25
**Task**: 收口清理波次遗留链路
**Branch**: `feature/v-799`

### Summary

删除无 producer 的 JCEF completion 等待链，修正 semantic review cache/fallback 与 corrupted backup 唯一性，清理 notice dead branch；focused Vitest 28/28、ESLint、typecheck、Rust 8/8 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `140963bc1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
