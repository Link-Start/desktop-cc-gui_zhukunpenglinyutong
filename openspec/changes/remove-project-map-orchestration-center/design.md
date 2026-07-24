# Design: remove-project-map-orchestration-center

<!--
 本文件是删除执行的工程依据：影响面地图 → 边界矩阵 → 五步删除顺序 → 每步测试 gate → 风险与回滚。
 核心原则：
 1) 删除边界限定死——只允许"删除对编排模块的引用"这一类跨模块修改；
 2) 测试链路兜底——每一步删除都有对应的既有/修改后测试守住行为不回归；
 3) 先迁后删——共享符号（open-task-run 事件总线）先迁移改引用，确认绿后再删模块。
-->

## 1. 影响面地图（2026-07-24 全仓扫描基线）

### 1.1 模块本体（整体删除，31 文件 / ~4940 行）

| 子路径 | 行数 | 职责 | 外部引用方 |
|---|---|---|---|
| `components/OrchestrationCenterView.tsx` (+`.test.tsx`) | 1210+495 | 编排中心主 UI；`orchestration-center__*` CSS 唯一使用方 | `useLayoutNodes.tsx:2479` |
| `types.ts` | 173 | 全部 `Orchestration*` 类型 | useLayoutNodes、layoutNodesTypes、app-shell |
| `index.ts` | 81 | 桶导出（类型 15 + 函数 ~25） | 同上 |
| `utils/taskStore.ts` (+test) | 348 | 持久化 store，key `"agentOrchestration.tasks"` | useLayoutNodes、ProjectMapPanel、app-shell |
| `utils/dispatchTask.ts` (+test) | 172 | 派发逻辑（flag 锁死，不可达） | 仅 `useAppShellKanbanExecutionSection.ts:224,278` |
| `utils/reviewTask.ts` (+test) | 115 | review gate 动作 | 仅 `useLayoutNodes.tsx:2425-2433` |
| `utils/taskRunLifecycleProjection.ts` (+test) | 80 | TaskRun 状态投影回编排任务 | 仅 useLayoutNodes |
| `utils/navigationEvents.ts` | 38 | **共享事件总线**（见 §2，先迁后删） | TaskCenterView、MessagesLinkedRunBanner、Messages.test |
| `utils/sourceRefs.ts` (+test) | 66+44 | sourceRef 构造 | 模块内 + useLayoutNodes |
| `utils/providerBoundary.test.ts` | 40 | provider 边界守卫测试 | 无 |
| `hooks/useOrchestrationTaskStore.ts` | 58 | store 订阅 hook | 仅 useLayoutNodes |
| `providers/` 6 个 provider (+5 test) | ~880 | projectMap/specHub/trellis/taskRun/repositorySignal/manual 候选生成 | projectMapProvider 被 `ProjectMapPanel.tsx:17-22` 引用 |

### 1.2 外部引用点（逐文件行级清单，即"允许修改清单"）

| 文件 | 修改点 | 修改类型 |
|---|---|---|
| `src/features/layout/hooks/useLayoutNodes.tsx` | `:58-80` import；`:207-228` projection signature；`:2233-2473` 状态 + 8 handler；`:2475-2519` 渲染切换（三元改恒渲染 ProjectMap 面板） | 纯删除 |
| `src/features/layout/hooks/layoutNodesTypes.ts` | `:8` import 类型；`:669-673` `onDispatchOrchestrationTask` option；`:1152` Pick 集合条目 | 纯删除 |
| `src/app-shell-parts/useAppShellKanbanExecutionSection.ts` | `:25-31` import；`:204-369` `handleDispatchOrchestrationTask`；`:1610` return 导出 | 纯删除 |
| `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` | `:390, 2211` 两处接线 | 纯删除 |
| `src/features/project-map/components/ProjectMapPanel.tsx` | `:17-22` import；`:104,115`；`:149,167` prop；`:233-234` state；`:1215-1255` handler；`:1924,1937` 传参 | 纯删除 |
| `src/features/project-map/components/ProjectMapDetailPanel.tsx` | `:71-85,103,116,147,160` 草稿入口残留（prop 已 `_` 闲置） | 纯删除 |
| `src/features/project-map/**/projectMapPanelModel.ts` / `ProjectMapPanelSurfaces.tsx` | `:105` / `:12` 各一处 | 纯删除 |
| `src/features/tasks/components/TaskCenterView.tsx` | `:5-8` import 改路径（保留 `OPEN_TASK_RUN_EVENT`，删 `dispatchOpenOrchestrationTaskEvent`）；`:87` 转发删除 | 删除 + import 改路径 |
| `src/features/tasks/components/RunDetailSurface.tsx` | `:152-153` "打开编排任务"按钮 | 纯删除 |
| `src/features/messages/orchestration/components/MessagesLinkedRunBanner.tsx` | `:3` import 改路径（组件本体保留） | 仅 import 改路径 |
| `src/i18n/locales/{10 语言}/agentOrchestration.ts` + 各 `index.ts` | 文件删除 + 注册两行删除；`projectMap.ts:764-781` ~10 keys；`taskCenter.ts:27,49` 2 keys | 纯删除 |
| `src/styles/workspace-home.css` | `orchestration-center__*` 157 处选择器（约 `:571-1377`） | 逐段核对后删除 |
| 6 个外部测试文件 | 见 §4.3 | 删除用例 / 改 import / 删 mock |
| `openspec/specs/agent-task-orchestration-center/` | 目录删除 | 随 verify/sync 流程 |

### 1.3 明确不碰（越界红线）

- `src/features/kanban/**`：对编排模块零引用，整个目录不许动。
- `useAppShellKanbanExecutionSection.ts` 除 §1.2 列出三处外的全部行。
- `src/features/messages/**`：除 `MessagesLinkedRunBanner.tsx:3` 一行 import 外全部不动；**`messages/orchestration/` 目录是消息组装控制器，严禁误删**。
- `src/features/tasks/types.ts:75,126`（`orchestrationTaskId?`）、`taskRunStorage.ts:263,282,388-390`（`source === "orchestration"` 分支）：死字段/死分支，保留。
- 引擎约束硬编码的另两处（`useAppShellKanbanExecutionSection.ts:209`、类型层）属于 kanban 语义，不在本 change 清理。

## 2. 关键决策：共享事件总线先迁后删

`navigationEvents.ts`（38 行）内有 6 个符号，分两类：

- **共享（保留，迁移）**：`OPEN_TASK_RUN_EVENT`（`"ccgui:open-task-run"`）、`dispatchOpenTaskRunEvent`、`readOpenTaskRunEvent`——被 TaskCenterView 监听、MessagesLinkedRunBanner 派发，服务 kanban/TaskRun 跳转，与编排中心无关。
- **编排专属（删除）**：`OPEN_ORCHESTRATION_TASK_EVENT`（`"ccgui:open-orchestration-task"`）、`dispatchOpenOrchestrationTaskEvent`、`readOpenOrchestrationTaskEvent`。

迁移方案：

1. 新建 `src/features/tasks/utils/taskRunNavigationEvents.ts`，**逐字复制**共享三个符号的实现（含 `typeof window === "undefined"` 守卫与 trim 语义）。事件名字符串不变 → window 事件协议零变化，跨模块通信不受影响。
2. 新增对应单测（从模块内既有行为补一个等价用例：dispatch → read 闭环、空 runId 守卫），保证迁移后符号有独立测试归属。
3. 三处引用改 import 路径：`TaskCenterView.tsx:5-8`、`MessagesLinkedRunBanner.tsx:3`、`Messages.test.tsx:14-16`。
4. 全绿后才进入模块删除步骤。

## 3. 删除顺序（五步，每步独立 commit、独立 gate）

> 顺序设计原则：**先断开引用，再删本体；每步结束代码库都必须可编译、可测试**。任何一步 gate 失败，停在该步修复或 `git revert` 该步，不带病进入下一步。

| 步 | 内容 | 删后状态 | Gate（见 §4） |
|---|---|---|---|
| S1 | 事件总线迁移（§2）：新文件 + 3 处 import 改路径 | 无功能变化，纯搬家 | G1 |
| S2 | 剥 app-shell 派发回调 + `layoutNodesTypes` contract + `useAppShellLayoutNodesSection` 接线 | dispatch 回调消失（本就被 flag 锁死，UI 不可达） | G2 |
| S3 | 剥 useLayoutNodes 装配（import/状态/handler/渲染切换）+ Task Center 入口 + Project Map 入口残留 | 运行时对编排模块零引用 | G3 |
| S4 | 删 `src/features/agent-orchestration/` 整目录 + i18n + CSS + 外部测试同步 | 编排中心不复存在 | G4 |
| S5 | 终验 + OpenSpec verify（删 main spec、跑全量） | 收尾 | G5 |

S2/S3 拆开的原因：app-shell 派发回调引用了 `taskStore` 与 `dispatchTask`，若先删 useLayoutNodes 会让 typecheck 错误混在一起难以归因；分层剥离保证每个 commit 的 diff 语义单一。

## 4. 测试链路兜底

### 4.1 删除前基线（G0）

在任何删除动作前执行并记录结果（写入 verification.md）：

```bash
npm run typecheck
npx vitest run src/features/project-map src/features/tasks src/features/messages src/features/layout src/app-shell-parts
```

基线必须全绿；若基线本身有红，先修复或在本 change 登记 waiver，不许在红基线上开始删除。

### 4.2 分步 gate

| Gate | 命令 | 守的行为 |
|---|---|---|
| G1 | `npx vitest run src/features/messages/components/Messages.test.tsx src/features/tasks/components/TaskCenterView.test.tsx` + `npm run typecheck` | `ccgui:open-task-run` 事件链路迁移后行为不变（banner 跳转、TaskCenter 监听） |
| G2 | `npx vitest run src/app-shell-parts` + `npm run typecheck` | kanban execution section 剥掉派发回调后，调度/链式/telemetry 用例全部原样通过（**这些用例一行不改**，作为 kanban 行为不变的证据） |
| G3 | `npx vitest run src/features/layout src/features/project-map src/features/tasks` + `npm run typecheck` | Project Map 面板恒渲染、Task Center 无编排入口；`ProjectMapPanel.test.tsx` 删 3 个编排用例后其余原样通过 |
| G4 | `npm run test`（全量）+ `npm run lint` + `npm run typecheck` | 模块删除后全库无悬挂引用、无测试孤儿 |
| G5 | `openspec validate --all --strict --no-interactive` + 手工 smoke（启动应用：Project Map 面板正常、kanban 正常、幕布 banner 正常） | spec 治理与运行时终验 |

### 4.3 外部测试的处置清单（只允许以下动作）

| 测试文件 | 动作 |
|---|---|
| `ProjectMapPanel.test.tsx` | 删 `:6` import 与 `:507-597` 三个编排用例；其余不动 |
| `TaskCenterView.test.tsx` | 删 `:6` 编排符号与 `:94-114` 跳转编排用例；`OPEN_TASK_RUN_EVENT` import 改路径 |
| `Messages.test.tsx` | `:14-16` import 改路径；用例本体不动 |
| `useLayoutNodes.client-ui-visibility.test.tsx` | 删 `:1008` 的 option mock 一处 |
| `useAppShellSections.kanban-text.test.ts` | 删 `:171` "orchestration dispatch wired" 整例 |
| `taskRunStorage.test.ts` / `taskRunCoordinator.test.ts` | **不动**（`orchestrationTaskId` 字段保留，fixture 继续有效） |

### 4.4 CSS 删除的防误删规程

`workspace-home.css` 的 `:571-1377` 区间内夹有非编排选择器。规程：只删选择器名以 `orchestration-center__` 开头的规则块（含其 media query 内的同名规则），删后对区间内剩余选择器逐一比对删除前快照确认无连带删除；G4 的全量测试中若有视觉相关快照用例可辅助兜底。

## 5. 风险与回滚

| 风险 | 概率 | 缓解 |
|---|---|---|
| 漏删引用导致 typecheck 红 | 中 | §1.2 行级清单 + 每步 typecheck gate；发现清单外引用先登记再删 |
| 误删 `messages/orchestration/`（命名撞车） | 低 | proposal/design 双处红线声明；删除命令只针对 `src/features/agent-orchestration/` 精确路径 |
| 事件名写错导致 banner 跳转静默失效 | 低 | 逐字复制 + 新增等价单测 + G1 双用例兜底 |
| CSS 连带删除 | 低 | §4.4 逐段核对规程 |
| kanban 行为回归 | 低 | kanban 用例零修改通过作为验收证据（G2/G4） |

回滚策略：五步各为独立 commit，任一步 gate 失败即 `git revert` 该 commit 回到上一稳定态；S1 迁移 commit 可独立 revert 而不影响后续（后续步骤尚未发生）。

## 6. 后续（独立 change，不属于本提案）

- 清理 `tasks/types.ts` 的 `orchestrationTaskId` 与 `taskRunStorage` 的 `"orchestration"` 死分支。
- 评估旧客户端 store key `"agentOrchestration.tasks"` 孤儿数据的一次性清理迁移。
- 调研报告 P0-9（拆 `useAppShellKanbanExecutionSection` 1614 行）在本 change 剥离 ~170 行后重新评估。
