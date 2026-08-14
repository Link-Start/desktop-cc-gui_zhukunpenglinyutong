---
type: inventory
status: active
owner: app-shell
related_plan: docs/plans/2026-08-11-app-shell-cohesion-optimization.md
related_execution: docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md（S4 PR 分解 :308-315）
created: 2026-08-14
branch: fix/performance-optimization
---

# AppShell S4 结构手术前现状盘点（PR-A）

> **用途**：S4「AppShell 分域结构手术」PR-B~F 的施工底图。只读盘点，不改生产代码。
> **采样日**：2026-08-14（commit `3970a5bf4`，S1 根链 memo 补全之后）。
> **口径**：全部数字为当日代码实测（`wc -l` / 解析 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` / 逐 hook grep），非历史文档转抄。

---

## 0. 特别回答（清单要求的四个关键数字）

| 问题 | 实测答案 | 证据 |
|------|----------|------|
| `composerContext` keys 现在多少 | **141**（与 2026-08-11 一致，未减） | `src/app-shell/domains/appShellDomainContexts.ts:297` |
| `settingsContext` keys 现在多少 | **147**（未减） | 同文件 `:588` |
| `layoutContext` keys 现在多少 | **103**（未减） | 同文件 `:440` |
| `useAppShellRootComposition.ts` 现在多少行 | **2420 行**（清单写 2424，今日实测 2420） | `src/app-shell/assembly/useAppShellRootComposition.ts` |
| 根是否仍订阅 threads | **是**。根 composition 直接调用 `useThreads`（`:800`），其返回的 `threadsByWorkspace` / `threadStatusById` / `tokenUsageByThread` / `rateLimitsByWorkspace` 等经 `useActiveSessionProjection`（`:848`）在根层消费；threads reducer 每次 dispatch 都会触发整根 2420 行 hook 链重跑 | 同文件 `:800`、`:848` |

---

## 1. 根 hook 列表（useAppShellRootComposition.ts，2420 行）

装配形态：`AppShell`（`assembly/AppShell.tsx`，30 行，仅 1 种 composition hook）→ `useAppShellRootComposition`（2420 行）+ `AppShellZoneProviders` + `AppShellView`（43 行）。`src/app-shell.tsx` 本身已退化为 1 行 re-export。

根 composition 内共 **约 57 个自定义 hook 调用点 + 3 个 `useState` + 26 处 React 原语**（useCallback/useMemo/useEffect/useRef）。按行号全量：

| 行号 | Hook | 域归属（建议） |
|-----:|------|----------------|
| :97 | useTranslation | — |
| :105 | useAppShellClaudeThinkingSection | settings/composer |
| :128 | useAppSettingsController | settings |
| :129 | useCodeCssVars | layout |
| :134 | useAppShellComposerPrefsPersistence | composer |
| :150 | useDictationController | dictationSurface |
| :159 | useDebugLog | debug（面板关闭时已缓冲，见 §3） |
| :160 | useLiquidGlassEffect | layout |
| :203 | useWorkspaceSessionHost | workspace（**纯数据 host 已存在**） |
| :237 | useLayoutController | layout |
| :244/:246 | useState ×2（appMode / agentTaskScrollRequest） | modeRouting |
| :265 | useAppShellEditorLayoutSection | fileEditor/layout |
| :277 | useSettingsModalState | settings |
| :283 | useLoadingProgressDialogState | settings |
| :285 | useCreateSessionLoading | workspace |
| :291 | useAppShellModelSettingsAction | modelSelection |
| :299 | useAppShellSearchPaletteSection | navigation |
| :305 | usePanelLockState | layout |
| :316 | useUpdaterController | updater（cold） |
| :333 | useReleaseNotes | cold |
| :337 | useErrorToasts | notifications |
| :363 | useGitHubPanelController | gitSurface |
| :434 | useGitPanelController | gitSurface |
| :470 | useGitRemote | gitSurface |
| :480 | useGitRepoScan | gitSurface |
| :490 | useModels | modelSelection |
| :504 | useCollaborationModes | collaborationMode |
| :523 | useThreadScopedCollaborationMode | collaborationMode |
| :528 | useSkills | composer |
| :543 | useEngineController | engine |
| :553 | useAppShellAccessModeSection | accessMode |
| :582 | useKanbanDomainHost | kanban（host 已存在） |
| :592/:593 | useCustomPrompts / useCustomCommands | composer |
| :611 | useWorkspaceFiles | workspaceCatalog |
| :655 | useAppShellGitWorkspaceOpsSection | gitSurface |
| :666 | useComposerEditorState | composer |
| :691 | useSyncSelectedDiffPath | gitSurface |
| **:800** | **useThreads** | **threads（根仍直接订阅，PR-D 主战场）** |
| :830 | useGitStatusRefreshOnTurnSettle | gitSurface |
| :848 | useActiveSessionProjection | runtimeThread（纯数据投影已存在） |
| :888 | useComposerDomainHost | composer（host 已存在） |
| :936 | useAccountSwitching | accountSurface |
| :943 | useAutoExitEmptyDiff | gitSurface |
| :956 | useWorkspaceSelection | navigation |
| :967 | useCollaborationModeThreadSync | collaborationMode |
| :995 | useAppShellViewStateSection | layout |
| :1039 | useComposerController | composer |
| :1121 | useConversationDomainHost | conversation（host 已存在） |
| :1206 | useAppShellSearchRadarSection | radar |
| :1288 | useAppShellWorkspaceFlowsSection | workspace |
| :1356 | useWorktreePrompt | gitSurface |
| :1379 | useMultiRepositoryGitStatus | gitSurface |
| :1437 | useGitCommitController | gitSurface |
| :1457 | useAppShellPromptActionsSection | composer |
| :1478 | useAppShellWorktreeChromeSection | gitSurface |
| :1496 | useAppShellDesktopChrome | layout |
| :1498 | useWorkspaceRestore | workspace |
| :1506 | useWorkspaceRefreshOnFocus | workspace |
| :1520 | useWorkspaceActions | workspace |
| :1550 | useWorkspacePathsIntake | workspace |
| :1560 | useAppShellDomainAssembly（~700 行，690-key bag 装配点） | **domains（PR-C/E 主战场）** |
| :2255 | useAppShellQuickSwitcherSection | navigation |
| :2280/:2293/:2307 | useMemoized{RuntimeThread,Composer,LayoutChrome}ProviderValue | providers |

`AppShellView`（43 行）再调 3 个 section hook：`useAppShellSections` / `useAppShellSearchAndComposerSection` / `useAppShellLayoutNodesSection`（后者即 `useLayoutNodes` 的调用方，2477→同量级大文件，S1 已稳定其输出节点身份）。

---

## 2. Context 读侧矩阵（2026-08-14 实测）

事实源：`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`（`appShellDomainContexts.ts:48`）逐项解析计数。对照 `app-shell-ownership-matrix.md:51-59`（2026-08-11 采样）：**15 域 690 keys，与 8-11 完全一致，一把未减**。

| Domain | Keys（8-14 实测） | 8-11 采样 | 目标 | 冻结/门禁 |
|--------|-----:|-----:|------|-----------|
| runtimeThreadContext | 10 | 10 | 保持窄 | soft 80 |
| sessionIdentityContext | 12 | 12 | 保持窄 | soft 80 |
| workspaceCatalogContext | 29 | 29 | 保持 | soft 80 |
| gitSurfaceContext | 79 | 79 | 与 git panel 同频 | soft 80（接近上限） |
| modeRoutingContext | 6 | 6 | 保持窄 | soft 80 |
| accountSurfaceContext | 4 | 4 | 保持窄 | soft 80 |
| dictationSurfaceContext | 10 | 10 | 保持窄 | soft 80 |
| workspaceNavigationContext | 78 | 78 | ≤80 → 40–60 | soft 80（接近上限） |
| **composerContext** | **141** | 141 | ≤60 | hard freeze 141 |
| **layoutContext** | **103** | 103 | ≤60 | hard freeze 103 |
| fileEditorContext | 41 | 41 | ≤60（已达） | soft 80 |
| **settingsContext** | **147** | 147 | ≤60 | hard freeze 147 |
| runtimeContext | 1 | 1 | 保持极窄 | soft 80 |
| modelSelectionContext | 14 | 14 | 保持窄 | soft 80 |
| collaborationModeContext | 15 | 15 | 保持窄 | soft 80 |
| **合计** | **690** | **690** | ≤60/域 | — |

**Consumer 订阅**（`APP_SHELL_CONSUMER_DOMAIN_SELECTION`，`appShellDomainContexts.ts:837`，与 ownership-matrix :61-69 一致）：

| Consumer | 路径 | 订阅域数 | 说明 |
|----------|------|:---:|------|
| layoutNodes | `useAppShellLayoutNodesSection.tsx` | **15/15（全量）** | 仍是最宽读侧；任何域更新都扇出到布局节点链 |
| sections | `useAppShellSections.ts` | 11/15 | 无 runtimeThread / modelSelection / collaborationMode / runtime |
| render | `renderAppShell.tsx` | 12/15 | 无 runtimeThread / modelSelection / collaborationMode |

浅比较兜底：`reuseStableAppShellDomainContexts`（`appShellDomainContexts.ts:909`）按域做 shallow-equal 复用旧引用——域内任一 key 变更即整域换新引用，**域越大误伤越宽**（composer 141 keys 意味着任一 composer key 变化，141 个 key 的浅比较 + 全 consumer 重渲染）。这是「单价仍高」的结构性根因之一。

---

## 3. 更新源矩阵（谁会敲根的门，频率量级）

「敲根」= 触发 `useAppShellRootComposition` 所在组件（AppShell）重渲染，即整链 2420 行 hook 重跑 + 690-key bag 重装配 + 15 域浅比较。

| 更新源 | 路径 | 是否敲根 | 频率量级 | 备注 |
|--------|------|:---:|------|------|
| **live 正文 delta** | `liveAssistantTextChannel`（flag `liveTextExternalization` 默认开） | **否** | hot（逐 delta，压测 128 chunk/16ms ≈ 数千/s） | 01/02 已外部化；不进根 reducer |
| **live 思考/工具 delta** | `liveItemDeltaChannel` | **否** | hot（~30 条/s 电报密度） | 同上；10 万 chunk 压测根 dispatch ≤ 50（`ROOT_DISPATCH_BOUND`，`reasoning-chunks.stress.test.ts:47`），实测单 lane ≈ 3 次/回合（建壳 + settle drain） |
| **threads reducer（turn 级）** | `useThreads` :800 → 根直接消费 | **是** | mid（回合级：ensureThread / status 迁移 / tokenUsage / rateLimits / 队列操作） | **根仍订阅 threads 的实证**；`tokenUsageByThread` 经 `threadReducerThreadIdentity.ts:171` 换引用，回合内 itemCompleted 级更新仍会打根 |
| git status 轮询 | `useGitStatus`（active/background 均 **15s**，`useGitStatus.ts:27-31`） | 是 | cold-mid（15s/次 + turn settle 联动刷新 :830） | appMode 门控已落地（chat/gitHistory 才 active，commit `5ae96e926`） |
| git log 轮询 | `useGitLog.ts:103`（enabled 时间隔刷新） | 是 | cold-mid | 仅 git 面板启用时 |
| focus 刷新 | `useWorkspaceRefreshOnFocus`（focusRefreshWave 注册） | 是 | cold（窗口聚焦事件） | 事件驱动，合规 |
| debug 日志 | `useDebugLog`（根 :159） | 部分 | 面板开：每条引擎日志一次根渲染（100ms+，见 `useDebugLog.ts:288-291` 注释）；**面板关：只进内存缓冲，不碰 React state（已缓解）** | 长尾项，PR 之外已部分收口 |
| runtime notice dock | `useGlobalRuntimeNoticeDock`（在 useLayoutNodes 内） | 是（经 layoutNodes） | cold（事件 + visibility-gated 兜底轮询） | S1 已稳定其节点身份 |
| updater / releaseNotes / skills / models / prompts / commands / settings | :316/:333/:528/:490/:592/:593/:128 | 是 | cold（启动/手动触发） | 低频，非手术重点 |
| dictation | `useDictationController` :150 | 是 | mid（听写会话期间秒级） | 已有独立 dictationSurface 域 |
| heartbeat 类 | — | 否 | — | messagesNode 已去 heartbeat（S1 注释 :1416 区域） |

**结论**：敲根的门已从「逐 delta」收窄到「回合级 + 15s 轮询 + 低频事件」。剩余单价高的原因不在敲门频率，而在**每次敲门的全量成本**：2420 行 hook 链重跑 + 690-key bag 重装配 + 全 15 域扇出到 layoutNodes 读侧。这正是 PR-B~F 要砍的部分。

---

## 4. PR-B~F 施工锚点（基于今日实测）

| PR | 现状锚点 | 关键约束 |
|----|----------|----------|
| PR-B 纯数据 host | `useWorkspaceSessionHost`(:203)、`useComposerDomainHost`(:888)、`useConversationDomainHost`(:1121)、`useKanbanDomainHost`(:582)、`useActiveSessionProjection`(:848) **已存在**——B 的增量是把剩余 inline 派生（git 段 :1379-1437、workspace flows :1288-1550）继续收进 host，并让 section hook 从 host 读而非各自重算 | host 必须无 UI、可单测；参考现有 host 测试（`useWorkspaceSessionHost.test.tsx`） |
| PR-C Composer 域下沉 | composerContext 141 keys（hard freeze）；composer 相关根 hook：:134/:528/:592/:593/:666/:1039/:1457 共 7 处 | `ComposerProvider` 已挂（:2293）；目标 ≤60 keys，输入路径与根解耦 |
| PR-D Messages/Conversation 域下沉 | 根仍 `useThreads` :800 直订；live 数据已走 channel（不进 bag），**剩 turn 级投影**（threadStatusById / tokenUsageByThread / rateLimits / 队列）仍进根 bag | **不得把 live 数据塞回根 bag**；channel 边界（`liveAssistantTextChannel` / `liveItemDeltaChannel`）是既定事实，压测门禁 `perf:streaming:stress` 会拦截回退 |
| PR-E Settings/Git/Kanban 条件挂载 | settings 147 / layout 103（hard freeze）；settings 相关根 hook :128/:277/:283 等 | 与 S3 appMode 条件挂载合流；git 轮询已按 appMode 门控，可参照 |
| PR-F 删 legacy flatten | `adaptAppShellLegacyFlatContext` 已标 @deprecated（`appShellDomainContexts.ts:884-892`）；生产 full-flatten 已被 `appShellFlattenGate` 禁 | F 是删除动作，放最后；删前确认 governance 测试同步改 |

**防回潮门禁（已全部在线，每 PR 必跑）**：`npm run check:app-shell:governance`（domain ownership + key 预算 + 行数预算 + 禁生产 flatten）；`npm run perf:realtime:boundary-guard`；`npm run perf:streaming:stress`。

**测量纪律**：正式测量关 react-scan（2~3x 放大器）；WKWebView 用 event-loop lag 而非 longtask。

---

## 5. 与既有文档的关系

- 本盘点是 `2026-08-11-app-shell-cohesion-optimization.md` §1.1 结构基线的 2026-08-14 复测：**keys 690→690、根 2420 行（文档口径 2424，实测 2420）、根仍订阅 threads**——「冻结现状」未变，PR-B~F 仍需真减。
- 读侧/ownership 结论与 `app-shell-ownership-matrix.md` 一致，无漂移。
- S1 根链 memo 补全（Task 2）已于 `3970a5bf4` 落地，与本文档同日。

---

## 6. PR-B 完成回写（2026-08-14）

`useAppShellRootComposition.ts` **2420 → 2362 行**（-58）；`ROOT_COMPOSITION_HARD_LINES` 门禁 2600 → **2400** 咬住进步。收编的纯数据 host/selector（均无 UI、配单测、行为不变）：

| 抽离物 | 域 | 原位置 |
|--------|-----|--------|
| `useGitSurfaceRepositoryActionsHost`（multi-repo stage/unstage/revert 7 handler） | gitSurface | :1380-1415 |
| `composerEditorSettings.ts`（`buildComposerEditorSettings` + `useComposerEditorSettings`，字段级 deps 口径不变） | composer | :668-689 |
| `composerSelectionResolver.ts`（`useComposerSelectionResolver`，ref 账本 + 读取器） | composer | :699-710 |
| `gitHubPanelGating.ts`（`resolveShouldLoadGitHubPanelData`） | gitSurface | :462-465 |
| `workspaceFilesGating.ts`（`resolveWorkspaceFilesLoadFlags`） | workspaceCatalog | :598-600 |

新增单测 5 文件 18 测试全绿；governance 7 文件 20 测试全绿；`perf:realtime:boundary-guard` / `perf:streaming:stress` 无回退。未新增 shell 状态（`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 不变，690 keys 冻结口径不破）。剩余 inline 派生已所剩无几——根余量主要在 ~700 行 `useAppShellDomainAssembly` bag 装配（PR-C/E 战场）与 `useThreads` 直订（PR-D 战场）。
