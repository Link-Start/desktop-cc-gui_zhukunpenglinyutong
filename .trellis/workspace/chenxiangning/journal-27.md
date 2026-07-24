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
