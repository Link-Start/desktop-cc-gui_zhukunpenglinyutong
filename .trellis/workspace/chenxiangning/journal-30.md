# Journal - chenxiangning (Part 30)

> Continuation from `journal-29.md` (archived at ~2000 lines)
> Started: 2026-08-01

---



## Session 1254: fix Shared Hidden Binding 五引擎隐藏

**Date**: 2026-08-01
**Task**: fix Shared Hidden Binding 五引擎隐藏
**Branch**: `bump-version-0.7.14`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | Shared Session 下 Grok/Kimi/OpenCode Hidden Binding 泄漏到 sidebar（MOSSX_CONTEXT_PACK） |
| 方案 | 对齐 Claude：Grok 预分配 identity；Kimi/OpenCode normalize 前缀；FE hide set 扩展 + rebind |
| OpenSpec | fix-shared-hidden-binding-visibility |
| 边界 | 不清理历史 orphan；不用标题启发式；不改用户 Native 会话 |

**Updated Files**:
- `src-tauri/src/engine/grok.rs`
- `src-tauri/src/shared_session_v2.rs`
- `src-tauri/src/shared_runtime_coordinator.rs`
- `src-tauri/src/shared_sessions.rs`
- `src/features/shared-session/runtime/sharedSessionSummaries.ts`
- `src/features/threads/hooks/useThreadActions.ts`
- `src/features/app/hooks/useAppServerEvents.ts`
- `openspec/changes/fix-shared-hidden-binding-visibility/**`


### Git Commits

| Hash | Message |
|------|---------|
| `33d7d02c6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1255: 统一幕布轻量下线与多 CLI 过程投影

**Date**: 2026-08-01
**Task**: 统一幕布轻量下线与多 CLI 过程投影
**Branch**: `bump-version-0.7.14`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | unify-conversation-canvas |
| 轻量墙 | 对话/行级「详情已延迟」下线；块级显示详情保留 |
| Grok 水管 | chat_history.jsonl 增量 tail + resume baseline |
| 呈现对齐 | Grok/Kimi/OpenCode 藏 bash；读/写/搜专用块 |
| 文件修改 | 有 diff 则 +N 可展开；无 diff 则开编辑器（非双栏 git） |
| 验收 | 用户手测通过后 commit |

**Updated Files**:
- `src-tauri/src/engine/grok.rs` / `grok_history.rs` / `kimi.rs` / `events.rs`
- `src/features/messages/**` (lightweight, ToolBlockRenderer, file edit scene)
- `openspec/changes/unify-conversation-canvas/**`
- `docs/analysis/*` / `docs/plans/2026-08-01-unified-conversation-canvas-architecture.md`


### Git Commits

| Hash | Message |
|------|---------|
| `bf3b35bd6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1256: 修复当前页添加模型弹窗样式丢失

**Date**: 2026-08-01
**Task**: 修复当前页添加模型弹窗样式丢失
**Branch**: `bump-version-0.7.14`

### Summary

VendorModelManagerDialogHost 在 AppShell 打开时未加载 settings.css，导致 vendor-dialog 样式整块丢失。open 时 useFeatureStylesReady(loadSettingsStyles) 并 gate isOpen，补源码契约测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8d75e7a6a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1257: fix-native-codex-local-model-select-freeform

**Date**: 2026-08-01
**Task**: fix-native-codex-local-model-select-freeform
**Branch**: `bump-version-0.7.14`

### Summary

修复 Codex 本地配置下 Native 点选模型勾选不变；允许 Native/Shared catalog 外自定义模型名；更新契约文档并提交收口。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `44fcf26a6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1258: 修复冷启动 React #185 useModels effort 双写

**Date**: 2026-08-01
**Task**: 修复冷启动 React #185 useModels effort 双写
**Branch**: `bump-version-0.7.14`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | 冷启动 Maximum update depth (#185)，AppShell 被 ErrorBoundary 替换 |
| 根因 | useModels selection layout 与 effort backfill 对 selectedEffort 互写 |
| 修复 | resolveModelEffort/planComposerModelSelection 单源；幂等 commit；删互踩 effect；snapshot ref |
| 回归 | useModels.test.tsx 23 通过 |
| 文档 | docs/analysis/react-185-maximum-update-depth-playbook.md（可追加 case/backlog） |


### Git Commits

| Hash | Message |
|------|---------|
| `4c5e97c8e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1259: 修复焦点跟随吸底偏差与快流抖动

**Date**: 2026-08-01
**Task**: 修复焦点跟随吸底偏差与快流抖动
**Branch**: `bump-version-0.7.14`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | 焦点跟随吸底不准（会话结束差一点）；快流时幕布抖动 |
| 根因 | stick 绑 working/finalizing；同 run 反复 cancel/restart 收敛 |
| 修复 | stick=liveAutoFollow+autoScroll；复用活跃 run+nudge；rAF 合并 |
| 范围 | 全引擎共用滚动层 |
| 验证 | live-behavior 67 + scroll convergence 7 全绿 |

**Updated Files**:
- `src/features/messages/orchestration/hooks/useMessagesScrollController.ts`
- `src/features/messages/components/MessagesCore.tsx`
- `src/features/messages/components/Messages.live-behavior.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `b3cbfaa8c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1260: 幕布滚动所有权重构与权威回底收口

**Date**: 2026-08-01
**Task**: 幕布滚动所有权重构与权威回底收口
**Branch**: `bump-version-0.7.14`

### Summary

引入 Scroll Ownership 状态机与 pinCanvasToBottom；覆盖 send/settle/deferred 回刷/Claude-Codex finalizing；手测可接受后提交

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | refactor-conversation-canvas-scroll-ownership |
| 设计文档 | docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md |
| 核心实现 | scrollAuthorityMachine + pinCanvasToBottom + continueBottomPinIfArmed |
| 引擎收敛 | Claude/Codex finalizing 起止 pin；MIN_FORCED_HOLD 覆盖 Codex 6s |
| 验证 | 相关 vitest 150 绿；手测 Grok/Codex/Claude 可接受 |
| 未纳入 | 他人 models/threads/shared-session 等无关改动 |


### Git Commits

| Hash | Message |
|------|---------|
| `b34fdaead` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1261: 修复 Shared Session 切换后的实时投影

**Date**: 2026-08-01
**Task**: 修复 Shared Session 切换后的实时投影
**Branch**: `bump-version-0.7.14`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| Shared projection | 将 canonical `shared:*` 首个 assistant shell 提升为 lifecycle-critical，避免运行中切换会话后 UI 停止更新。 |
| Activation reconciliation | Shared 激活时只提交目标 thread 的 raw/normalized structural operations，不 flush 其他会话。 |
| Owner routing | 验证 hidden native event 仍通过 authoritative `sharedOwner` 投影到 canonical Shared thread。 |
| Performance boundary | 后续正文继续走 `liveAssistantTextChannel`，未恢复逐 delta root reducer dispatch。 |
| OpenSpec | 新增并完成 `fix-shared-session-live-projection-resume`，tasks 10/10。 |

**验证**：
- Shared routing/projection focused Vitest 通过。
- Canvas/store/subscription Vitest 10/10 通过。
- Focused ESLint 通过。
- `pnpm typecheck` 通过。
- 当前 OpenSpec change strict validation 通过；全局 OpenSpec validation 的两个失败来自无关既有 changes。
- 按用户要求未运行全量测试。

**主要文件**：
- `src/features/threads/hooks/useThreadItemEvents.ts`
- `src/features/threads/hooks/useThreadItemEvents.sharedNavigation.test.ts`
- `src/features/shared-session/runtime/sharedSessionBridge.test.ts`
- `src/features/app/hooks/useAppServerEvents.test.tsx`
- `openspec/changes/fix-shared-session-live-projection-resume/`


### Git Commits

| Hash | Message |
|------|---------|
| `9d8a3048c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1262: 修正 Codex 模型思考强度映射

**Date**: 2026-08-01
**Task**: 修正 Codex 模型思考强度映射
**Branch**: `bump-version-0.7.14`

### Summary

按逐模型 catalog 校准 Codex degraded reasoning fallback，补齐 Native 单一会话 custom-model 的 Composer、send 与 app-server wire 回归覆盖；focused checks 与 OpenSpec strict 通过，未运行全量测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ca48f5458` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1263: 收敛 docs 文档历史

**Date**: 2026-08-01
**Task**: 收敛 docs 文档历史
**Branch**: `feature/v-0714`

### Summary

(Add summary)

### Main Changes

### Summary

将 `feature/v-0714` 上的文档校准 merge bubble 收敛为线性历史。以 `b81ae049f` 为稳定基线，保持原 `b3ff47a14` 的 `docs/**` 最终树完全一致，并将文档内容整理为单一提交 `7f14c0a13`。旧过程未丢失：来源提交 `f3c9da4db`、`72f6befe5` 仍由 `origin/bump-version-0.7.14` 保存，原合并现场 `d7e94283c`、`b3ff47a14` 由本地 backup branch 保存。

### Main Changes

- 建立 `backup/feature-v-0714-before-doc-history-cleanup-20260801-1745` 恢复锚点。
- 将 `docs: 校准全库文档与现行实现` 与后续语义合并结果收敛为 `docs: 整合并校准全库文档`。
- 保留 `Preference Settings UI/UX Guide`、结构化 docs 索引、analysis/reports/browser-agent/superpowers 分区，以及 lifecycle/current delta 校准。
- 删除当前分支中重复的两条旧 Trellis session，合并为本条记录，避免会话历史膨胀和失真。
- 未修改业务代码、OpenSpec、远程分支；未执行 push 或 force push。

### Validation

- `docs/**` tree hash：新提交与清理前 backup 均为 `7c45dcc4d7225f557abab4fe94e0a4d8817be9a7`。
- `git diff --cached --check` 通过。
- 冲突标记扫描通过，暂存范围仅包含 `docs/**`。
- 相同文档树此前已验证 119 篇 Markdown 本地链接 0 失效。
- lint/typecheck 未重复运行；当前分支已知业务代码 baseline error 与 docs-only 历史整理无关。

### Status

[OK] **Completed**

### Next Steps

- 如需发布，当前 `feature/v-0714` 可从 `origin/feature/v-0714` fast-forward push，无需 force push。


### Git Commits

| Hash | Message |
|------|---------|
| `7f14c0a13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1264: 供应商空模型兜底与自定义模型思考强度默认档

**Date**: 2026-08-01
**Task**: 供应商空模型兜底与自定义模型思考强度默认档
**Branch**: `feature/v-0714`

### Summary

(Add summary)

### Main Changes

| Feature | Description |
|---------|-------------|
| Catalog 刷新 | 供应商 add/update/delete/switch/settings-json-saved/cc-switch import 后失效模块级 catalog 缓存，picker 监听事件重置投影并重拉 provider list，无需重启见新渠道 |
| 空模型兜底 | managed 渠道空 catalog 回退读取供应商配置默认模型（Claude ANTHROPIC_*/DEFAULT_*、Kimi/Grok model、OpenCode models[0]），兜底 row 不写模块级 cache |
| 空态引导 | 子菜单空模型渠道两行引导文案 + 保留「添加模型」入口，全 10 locale 补齐 |
| Reasoning 默认档 | 自定义 Codex 模型暴露 low/medium/high/xhigh（默认 medium），选择/切渠道播种 reasoning，用户已选 effort 不覆盖 |

**OpenSpec**:
- `enhance-provider-empty-model-and-custom-reasoning`（proposal/design/tasks/specs，`openspec validate --strict` 通过）

**关键文件**:
- `src/features/models/customModelReasoning.ts`（新增）
- `src/features/composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners.ts`
- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`
- `src/features/models/hooks/useModels.ts`
- 五个 vendor management hooks + `VendorSettingsPanel.tsx`
- i18n：10 个 locale 的 `models.ts`

**验证**: ChatInputBox/models/vendors/i18n 631 个测试全绿；tsc 仅剩 3 个既有错误（useAppShellLayoutNodesSection 171/176、Composer 1053）；ESLint 与 diff-check 干净。


### Git Commits

| Hash | Message |
|------|---------|
| `b92a3c92b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1265: 解决 PR #971 与 main 的 #185 冲突并推送

**Date**: 2026-08-01
**Task**: 解决 PR #971 与 main 的 #185 冲突并推送
**Branch**: `bump-version-0.7.14`

### Summary

合并 upstream-main 解决 docs/README、#185 playbook、useModels.test 冲突；再合入远端 messages 稳定化提交；push 后 PR #971 变为 MERGEABLE。

### Main Changes

## 做了什么
- 检查 PR #971 (bump-version-0.7.14 → main) 冲突状态与本地 merge in progress
- 确认 3 个冲突文件工作区已语义融合（无 <<<<<<< 标记）
  - docs/README.md：ours 全库导航 + 专项材料 + #185 链接
  - docs/analysis/react-185-maximum-update-depth-playbook.md：保留 Fix commit 与索引（ours）
  - useModels.test.tsx：保留 #185 回归 + 自定义模型测例（ours 超集）
- useModels.ts 已 auto-merge 为 ours（#185 结构 + 自定义 reasoning）
- git add 标记解决并完成 merge(main) commit
- vitest useModels.test.tsx 25/25 通过
- push 被拒后 fetch：远端多 1 个 fix(messages)，clean merge 后再次 push
- PR #971 mergeable=MERGEABLE / mergeStateStatus=CLEAN

## 刻意未纳入
- 工作区曾出现无关脏改动（app-shell freeform model / provider activate 回退、DEBUG sentinel），已 restore，未提交

## 验证
- pnpm exec vitest run src/features/models/hooks/useModels.test.tsx → 25 passed
- gh pr view 971 → MERGEABLE / CLEAN


### Git Commits

| Hash | Message |
|------|---------|
| `0fd81eede` | (see git log) |
| `4732d92ac` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1266: 加固 React #185 收敛（freeform 不回退）

**Date**: 2026-08-01
**Task**: 加固 React #185 收敛（freeform 不回退）
**Branch**: `feature/v-0714`

### Summary

B1 切断 useModels layout self-deps；会话 selection 幂等；freeform 只修 effort；Collapsible 内层测量；dev 冷启动已确认不炸。

### Main Changes

## 做了什么
- useModels layout 仅依赖 catalog/preferred，selection 经 snapshot ref 读取
- useSelectedComposerSession 全路径 equality commit
- thread repair 保留 catalog 外 freeform modelId，仅收敛 unsupported effort
- CollapsibleUserTextBlock 测内层高度 + boolean 幂等
- app-shell.startup 用例对齐 freeform 语义并断言无 Maximum update depth
- playbook 追加 C-20260801-02，勾选 B1/B2/B6

## 验证
- vitest: useModels / app-shell.startup / useSelectedComposerSession 通过
- 用户 dev 启动确认：目前没炸

## 提交
- e6e964d88 fix(models): 加固 #185 收敛并保留 freeform 选择


### Git Commits

| Hash | Message |
|------|---------|
| `e6e964d88` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1267: Grok 思考强度接入

**Date**: 2026-08-01
**Task**: Grok 思考强度接入
**Branch**: `feature/v-0714`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|---|---|
| 能力 | Grok `reasoning.effort` supported；composer 选 low/medium/high；argv `--reasoning-effort` |
| 修复 | 无 thread 选 effort 被清；三层 allowlist；matrix generated 同步 |
| OpenSpec | `openspec/changes/grok-cli-reasoning-effort/` |
| 报告 | `docs/reports/grok-cli-reasoning-effort-2026-08-01.md` |
| 验证 | matrix check + vitest 64 + cargo effort 单测；用户确认外观 OK |

**Updated files (highlights)**:
- `src-tauri/src/engine/grok.rs`
- `src/app-shell-parts/modelSelection.ts`
- `src/features/composer/components/ChatInputBox/ButtonArea.tsx`
- `openspec/changes/grok-cli-reasoning-effort/**`


### Git Commits

| Hash | Message |
|------|---------|
| `75a847b9d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1268: Shared 历史幕布过程折叠与 Codex 文件修改投影对齐

**Date**: 2026-08-01
**Task**: Shared 历史幕布过程折叠与 Codex 文件修改投影对齐
**Branch**: `cxn-version-0.7.15`

### Summary

对齐 Shared 与 Native 幕布过程顺序/折叠展开/fileChange changes[] 保真，canvas projection v6

### Main Changes

## 本会话交付

| 维度 | 结果 |
|------|------|
| 过程顺序 | TurnCommitted：reasoning/tools → 结论 Text（折叠契约） |
| 折叠真实展开 | bash/command 回幕布；chip 计数含 shell 行 |
| Codex 文件修改 | ingest 打包 changes[]；投影还原 path/diff |
| Checkpoint | CANVAS_PROJECTION_VERSION → 6 |
| OpenSpec | sync-shared-session-curtain-parity |

## 验证

- cargo test --test shared_projection：25 passed
- cargo test --lib codex_file_change_item_preserves：ok
- vitest collapse + live-behavior + dataSource：97 passed

## 已知边界

- 旧 canonical 若从未写入 changes 无法回填
- tool↔text 交错时间戳仍无法 1:1 还原 live


### Git Commits

| Hash | Message |
|------|---------|
| `ef6dc9dbb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1269: Shared Codex apply_patch/文件修改投影二次修复

**Date**: 2026-08-02
**Task**: Shared Codex apply_patch/文件修改投影二次修复
**Branch**: `cxn-version-0.7.15`

### Summary

捕获 custom_tool_call apply_patch；投影解析 patch；dataSource enricher；v7

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b42626c1e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1270: Shared Codex command argv/apply_patch 投影修复

**Date**: 2026-08-02
**Task**: Shared Codex command argv/apply_patch 投影修复
**Branch**: `cxn-version-0.7.15`

### Summary

join command argv[]; promote apply_patch in commandExecution; v8

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a2f3e50ca` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1271: 幕布恢复隐藏 shell 且折叠只计文件读写

**Date**: 2026-08-02
**Task**: 幕布恢复隐藏 shell 且折叠只计文件读写
**Branch**: `cxn-version-0.7.15`

### Summary

hide commandExecution/bash; chip counts only visible file IO process; no remount of shell on expand

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9a2e35797` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1272: Codex 文件读写类 command 可见、纯 shell 仍隐藏

**Date**: 2026-08-02
**Task**: Codex 文件读写类 command 可见、纯 shell 仍隐藏
**Branch**: `cxn-version-0.7.15`

### Summary

unhide file-IO commandExecution; promote apply_patch; hide pwd/ls noise; chip counts visible only

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1e9ed803a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1273: 会话概览替换治理证据 + 提交消息引擎选择器收口

**Date**: 2026-08-02
**Task**: 会话概览替换治理证据 + 提交消息引擎选择器收口
**Branch**: `cxn-version-0.7.15`

### Summary

完成 replace-checkpoint-governance-with-session-overview 实现；统一 Git 提交消息引擎选择器，修复中英文/子菜单交互与 Grok managed provider 接入 401

### Main Changes

## 本会话交付

### 1. replace-checkpoint-governance-with-session-overview
- 结果 tab 默认渲染 SessionOverviewSection
- bottomActivity.governanceEvidence 默认 false，opt-in 后恢复治理证据与 verdict 参与
- 测试与 openspec change artifacts 已落盘

### 2. 提交消息引擎选择器 (add-cli-engine-visibility-toggle / unify-git-commit-engine-picker)
- 单面板 picker：上次配置 / 中英文 / 可见引擎
- 提交框位置改平铺项，避免 flyout 回不去
- 生成按钮图标从 last config 恢复，统一 EngineIcon
- engine_send_message_sync 对齐 Grok/Kimi/OpenCode managed provider，修复 commit-message 401

### Commits
- 5f52710f7 feat(status-panel): 用会话概览替换默认治理证据
- 867c1017d feat(git): 统一提交消息引擎选择器并修复 Grok 接入


### Git Commits

| Hash | Message |
|------|---------|
| `5f52710f7` | (see git log) |
| `867c1017d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1274: 修复过程折叠展开 bashGroup 空壳

**Date**: 2026-08-02
**Task**: 修复过程折叠展开 bashGroup 空壳
**Branch**: `cxn-version-0.7.15`

### Summary

render/count file-IO bash groups; pure shell still hidden

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2510b3957` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1275: 折叠 Shared turn-target badge 噪音

**Date**: 2026-08-02
**Task**: 折叠 Shared turn-target badge 噪音
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | Shared session 每条 assistant 都渲染 `CLI · Provider · model` badge，连续同 target 刷屏 |
| 策略 | Policy B：每个 user 后首条 assistant 显示；同 turn 连续相同 target 折叠；target 变更再显示 |
| 实现 | `buildTurnTargetBadgeVisibleItemIds` 预计算 → presentation state → Timeline → MessageRow `showTurnTargetBadge` |
| 测试 | `turnBadge.test.ts` + stream-mitigation UI 用例 |

**Updated Files**:
- `src/utils/turnBadge.ts` / `src/utils/turnBadge.test.ts`
- `src/features/messages/orchestration/hooks/useMessagesPresentationState.ts`
- `src/features/messages/orchestration/models/messagesTimelineModels.ts`
- `src/features/messages/components/MessagesCore.tsx`
- `src/features/messages/timeline/components/TimelineRowRenderer.tsx`
- `src/features/messages/rows/components/MessageRow.tsx`
- `src/features/messages/rows/presentation/messageRowEquality.ts`
- `src/features/messages/components/MessagesRows.stream-mitigation.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `50db10f0d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1276: 结果 Tab 降噪:会话概览取代治理证据与结果详情

**Date**: 2026-08-02
**Task**: 结果 Tab 降噪:会话概览取代治理证据与结果详情
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| Feature | Description |
|---------|-------------|
| 会话概览 section | 结果 Tab 头部常驻 SessionOverviewSection(engine/model/workspace/运行状态/时长/轮次/上下文/rate limit/待处理计数),数据全部来自 activeCanvasStore snapshot,无新增 tauri command |
| 治理证据默认关闭 | 新增 bottomActivity.governanceEvidence 可见性开关(默认 off),关闭时不读 workspace 文件、不渲染 section、governanceSnapshot 为 null,checkpoint verdict 与仓库 CI 状态解耦 |
| 结果详情默认关闭 | 新增 bottomActivity.checkpointDetails 开关(默认 off),门控 CostBudgetSection + CheckpointPanel;默认只剩会话概览,开关打开恢复完整 checkpoint 表面 |
| OpenSpec change | replace-checkpoint-governance-with-session-overview:proposal/design/tasks + status-panel-session-overview 新 capability delta,modified dynamic-project-governance-evidence / governance-evidence-bridge / status-panel-checkpoint-module |

**Updated Files**:
- `src/features/status-panel/components/StatusPanel.tsx`(门控 + 会话概览装配)
- `src/features/status-panel/components/SessionOverviewSection.tsx` / `utils/sessionOverviewViewModel.ts`(新增)
- `src/features/client-ui-visibility/utils/clientUiVisibility.ts`(两个新开关)
- `src/features/layout/hooks/useLayoutNodes.tsx` / `activeCanvasStatusPanelNode.tsx`(接线)
- `src/i18n/locales/{zh,en}/{settings,statusPanel}.ts`、`src/styles/status-panel.css`、`src/test/vitest.setup.ts`
- 测试:StatusPanel / SessionOverviewSection / sessionOverviewViewModel / clientUiVisibility,264+ 用例全绿,tsc 干净

**备注**:顺带修复并行 session 遗留的 Messages.history-loading.test.tsx 缺 ConversationItem import(随 5f52710f7 入库)。手工验收与 spec archive 待后续。


### Git Commits

| Hash | Message |
|------|---------|
| `5f52710f7` | (see git log) |
| `8a53489cf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1277: Shared 历史恢复 loading 阶段与进度条

**Date**: 2026-08-02
**Task**: Shared 历史恢复 loading 阶段与进度条
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | 打开历史 Shared session 先闪空态「今天想构建什么」 |
| 根因 | `shouldShowHistoryLoadingForSelectionThread` 排除了 `shared:` |
| 方案 | 启用 shared gate + loader 阶段进度上报 + 画布进度条与真实文案 |
| 阶段 | prepare → session 快照 → projection transcript → merge → finalize |

**Updated core**:
- `claudeThreadContinuity.ts` / `sharedHistoryLoader.ts` / `historyLoadingProgress.ts`
- progress 经 useThreadHistoryLoadingState → layout → Messages Timeline
- 文案 zh/en + `.messages-history-loading-bar`


### Git Commits

| Hash | Message |
|------|---------|
| `75bce0166` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1278: fix React #185 Composer file-ref 引用环

**Date**: 2026-08-02
**Task**: fix React #185 Composer file-ref 引用环
**Branch**: `cxn-version-0.7.15`

### Summary

加固 Composer file-ref / merge 引用稳定与 plan 收敛，切断 #185 更新深度自反馈；补回归与 playbook C-20260801-03

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | prod App-Bn4fZysL React #185，栈落 Composer / ActiveCanvasComposer |
| 主修 | mergeInlineFileReferences / mergeUniqueNames 无新增保引用 |
| 辅修 | plan 已收敛返回 null；creation engine 等价不 publish |
| 回归 | composerFileReferences.test / Composer.file-reference-token / useModels / app-shell.startup（64 tests） |
| Playbook | C-20260801-03（AP-02 主因 + defense-in-depth 措辞校准） |

**Updated Files**:
- `src/features/composer/utils/composerFileReferences.ts`
- `src/features/composer/utils/composerFileReferences.test.ts`
- `src/features/composer/components/Composer.tsx`
- `src/features/composer/utils/inlineSelections.ts`
- `src/features/models/hooks/useModels.ts`
- `docs/analysis/react-185-maximum-update-depth-playbook.md`


### Git Commits

| Hash | Message |
|------|---------|
| `637cb3561` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1279: merge upstream chore/bump-version-0.7.15

**Date**: 2026-08-02
**Task**: merge upstream chore/bump-version-0.7.15
**Branch**: `cxn-version-0.7.15`

### Summary

拉取并 merge upstream 落后的 8 个提交；消息幕布冲突保留本地 shell 过滤策略

### Main Changes

| 项 | 说明 |
|----|------|
| 操作 | `git pull --no-rebase upstream chore/bump-version-0.7.15` |
| 分叉 | local ahead 23 / remote ahead 8 → merge 后 local ahead 24 |
| 冲突文件 | 7 个 messages 相关（render/timeline/tests） |
| 策略 | 保留本地 hide pure shell + keep file IO；上游 always-show 不采纳 |
| 验证 | 相关 messages tests 101 passed |


### Git Commits

| Hash | Message |
|------|---------|
| `4e4d9fe9a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1280: status-panel 概览与供应商套餐额度

**Date**: 2026-08-02
**Task**: status-panel 概览与供应商套餐额度
**Branch**: `cxn-version-0.7.15`

### Summary

将结果 Tab 改为会话概览；接入 Coding Plan 额度路由（官方 runtime / 供应商 API），支持 Kimi/MiniMax/智谱与 Codex 官方分流。

### Main Changes

## 完成内容
- 概览 Tab：会话 id、工作区路径、落盘路径、引擎/模型、运行态与上下文
- Coding Plan 查询：`coding_plan_quota.rs`（Kimi/MiniMax/智谱）
- 路由：官方 Codex → account/rateLimits；第三方 base_url → 供应商 API；Kimi CLI oauth 优先
- Claude 官方不展示假额度；第三方 MiniMax/Kimi 展示套餐双窗口

## 后续
- 共享会话多供应商额度列表（下一项）


### Git Commits

| Hash | Message |
|------|---------|
| `215640267` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1281: 共享会话多供应商额度列表

**Date**: 2026-08-02
**Task**: 共享会话多供应商额度列表
**Branch**: `cxn-version-0.7.15`

### Summary

共享会话从 executionTargetSnapshot 去重收集供应商，并行查额度并多卡展示。

### Main Changes

## 完成
- collectSessionQuotaTargets：按 engine+providerProfileId 去重
- useSessionQuotaList：并行 getCodingPlanQuota
- 概览 UI 多额度卡 + 供应商行
- 官方 none 不占位；单会话行为不变

## 验证
- status-panel 测试全绿


### Git Commits

| Hash | Message |
|------|---------|
| `b0ef0b9b9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1282: 修复 CodexCatalogSessionSummary.physicalPath 类型

**Date**: 2026-08-02
**Task**: 修复 CodexCatalogSessionSummary.physicalPath 类型
**Branch**: `cxn-version-0.7.15`

### Summary

补齐 CodexCatalogSessionSummary.physicalPath 可选字段，消除 tsc TS2339，恢复 mac-arm64 前端构建。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8b36c6f13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1283: 修复 Windows Native Continuation artifact 路径 os error 267

**Date**: 2026-08-02
**Task**: 修复 Windows Native Continuation artifact 路径 os error 267
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| Feature | Description |
|---------|-------------|
| 根因 | Windows 下 artifact 目录名含 ASCII `:`（`claude:<uuid>`）触发 `ERROR_DIRECTORY (267)`；mac 允许 `:` 所以正常 |
| 修复 | `artifact_store` 路径 key 改为 `sha256(session_id)` 前 16 hex，logical session id 不再直接进入 path segment |
| 兼容 | 读取保留 legacy `{session_id}` 布局 fallback（带 `../` 穿越 guard），mac 旧 artifact 可读、孤儿扫描不误删 |
| 加固 | `safe_segment` 拒绝 Windows 保留字符 `\ / < > : " \| ? *`、控制字符、尾随点/空格、保留设备名（CON/PRN/AUX/NUL/COM1-9/LPT1-9） |
| OpenSpec | `fix-native-continuation-artifact-path-windows-compat` 走完 proposal/design/tasks/verification，已 sync `native-provider-continuation` main spec 并归档 |

**验证**: cargo lib shared_context 18/18、native_continuation 14/14、integration shared_session_v2 14/14、openspec validate --strict passed；mac 实机回归通过。既有失败 `codex_zero_delta_projection_does_not_create_marker_only_import` 与本改动无关（stash 后同样失败）。

**Updated Files**:
- `src-tauri/src/shared_context/artifact_store.rs`
- `.trellis/spec/backend/native-provider-continuation-contract.md`
- `openspec/specs/native-provider-continuation/spec.md`
- `openspec/changes/README.md`
- `openspec/changes/archive/README.md`
- `openspec/changes/archive/2026-08-02-fix-native-continuation-artifact-path-windows-compat/`


### Git Commits

| Hash | Message |
|------|---------|
| `94343833d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1284: fix: Native 过程折叠吸收孤儿思考

**Date**: 2026-08-02
**Task**: fix: Native 过程折叠吸收孤儿思考
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | Native Claude/Grok 流式 mid-plan 打断 process walk-back，顶部孤儿「思考过程」；Shared 图3 干净 |
| 修复 | turn-final ownership：终稿 assistant 吸收同 turn 全部 reasoning/tool/explore |
| 代码 | `messagesViewModel.ts` + collapseMiddleSteps tests |
| OpenSpec | `message-process-phase-collapse` main spec；归档 `2026-08-02-fix-native-process-phase-orphan-reasoning` |
| 验证 | vitest collapse 11 + projection 8 + live-behavior collapse 相关；openspec validate 通过 |

**未纳入**：session_management / SessionManagement UI 工作区脏文件


### Git Commits

| Hash | Message |
|------|---------|
| `cee3ec655` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1285: fix: 单步思考收进过程 chip

**Date**: 2026-08-02
**Task**: fix: 单步思考收进过程 chip
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 产品 | 单步思考也进 chip，Native/Shared 一致 |
| 改动 | count 门槛 1；投影层同步；单测覆盖 lone reasoning |
| 提交 | 见 commit |


### Git Commits

| Hash | Message |
|------|---------|
| `9c94ca1df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1286: fix(status-panel): Native 会话额度仅查当前供应商

**Date**: 2026-08-02
**Task**: fix(status-panel): Native 会话额度仅查当前供应商
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 根因 | Shared 多供应商额度列表无条件扫 history，Native 串台展示 kimi 等历史供应商 |
| 修复 | `includeHistory: isSharedSession`；Native 仅当前 binding |
| OpenSpec | `fix-native-session-quota-target-scoping` proposal/design/tasks/spec |
| 验证 | sessionQuotaTargets 5 tests 绿 |

**Updated Files**:
- `src/features/status-panel/utils/sessionQuotaTargets.ts`
- `src/features/status-panel/components/StatusPanel.tsx`
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `openspec/changes/fix-native-session-quota-target-scoping/**`


### Git Commits

| Hash | Message |
|------|---------|
| `46724bb45` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1287: SubAgent 幕布 persona 卡片与 inspector 抽屉

**Date**: 2026-08-02
**Task**: SubAgent 幕布 persona 卡片与 inspector 抽屉
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 模块 | 说明 |
|------|------|
| subagent-ui | 独立模块：小队网格/单卡、静态作者池 persona、幕布内抽屉 |
| 幕布接入 | groupToolItems subagentGroup、ToolBlock/Timeline 渲染、折叠豁免 |
| 右下角列表 | 单行可点，统一 openSubagentInspector |
| 闪屏修复 | 仅父 scope 关闭抽屉；嵌套 Messages 不再误关 |
| 清理 | 移除 StatusPanel 内联 EngineTaskOutput 死代码；测试对齐新 class |

**关键路径**
- `src/features/subagent-ui/**`
- `src/styles/subagent-ui.css`
- `openspec/changes/enhance-subagent-canvas-persona-ui/`

**验证**
- 相关 vitest 113 通过
- 用户人工验收通过


### Git Commits

| Hash | Message |
|------|---------|
| `49353a4c8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1288: fix Shared 模型供应商切换误入 Native 续接

**Date**: 2026-08-02
**Task**: fix Shared 模型供应商切换误入 Native 续接
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 主修复 | Shared 身份 id-first：`shared:` 硬闸，threadKind 仅兜底 |
| 爆炸半径 | picker / send getThreadKind / delete 绑定清理 / 续接 prepare |
| 附带 | useModels freeform 用户锁 + catalog 指纹 + persist 归一（#185） |
| OpenSpec | `fix-shared-session-identity-id-first` T1–T3 |
| 验证 | vitest 103 通过；tsc --noEmit 通过 |
| 未做 | T4 hydrate 写序；T5 merge 保护 |

**关键文件**:
- `src/features/shared-session/utils/sharedSessionIdentity.ts`
- `src/features/composer/components/Composer.tsx`
- `src/features/threads/hooks/useThreads.ts`
- `src/features/models/hooks/useModels.ts`
- `docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md`


### Git Commits

| Hash | Message |
|------|---------|
| `8468544a5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1289: 跨引擎 SubAgent 适配 Codex/Grok/Kimi/Shared

**Date**: 2026-08-02
**Task**: 跨引擎 SubAgent 适配 Codex/Grok/Kimi/Shared
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 缺口 | 修复 |
|------|------|
| Codex collab 幕布扁条 | isSubagentTool + spawn 展开 persona 卡 |
| 历史点开空抽屉 | 全引擎 history loader + output 回退 |
| Kimi agent swarm | title/XML 识别与多卡展开 |
| Grok Subagent N | title 识别 + 幕布分组 |
| 会话树无父子 | live 投影跨引擎 pending + collab parent 链接 |
| StatusPanel | Grok/Kimi task-like 纳入列表 |

**提交** `4b4b9a18f`


### Git Commits

| Hash | Message |
|------|---------|
| `4b4b9a18f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1290: 整体下线会话活动与 Solo 模式（接线级 disable + OpenSpec）

**Date**: 2026-08-02
**Task**: 整体下线会话活动与 Solo 模式（接线级 disable + OpenSpec）
**Branch**: `cxn-version-0.7.15`

### Summary

产品决定整条下线「会话活动」面板与 Solo 模式，接线级 disable 保留源码便于回滚，雷达与底部活动面板不受影响。

### Main Changes

| 项 | 内容 |
|----|------|
| 入口 | PanelTabs 新增 SHOW_ACTIVITY_TAB=false，顶栏/更多菜单无「活动」，pin 过滤 activity |
| 接线 | 壳层 useAppShellSearchRadarSection 与布局 useLayoutNodes 停调 useWorkspaceSessionActivity，改用冻结空 viewModel DISABLED_WORKSPACE_SESSION_ACTIVITY |
| 面板与残留态 | filePanelMode==="activity" 不挂载 WorkspaceSessionActivityPanel，回落 files；setter/tab select 双拦截 activity→files |
| Solo | soloModeEnabled 恒 false，进入短路、按钮不展示，useSoloMode enabled 兜底退出 |
| 连带下线 | Live Edit Preview 固定 enabled=false；Quick Switcher AI 最近文件改喂稳定空 timeline |
| OpenSpec | disable-session-activity-and-solo-mode 全套 artifacts（proposal/design/tasks/3 个 delta specs）validate --strict 通过 |
| 验证 | PanelTabs/QuickSwitcher/GitPanel/SearchRadar/layout visibility/app-shell startup focused Vitest 全绿；npm run typecheck 通过 |
| 边界 | 未碰雷达、底部活动面板、Git/Files/Search；未删源码与 CSS/i18n |
| 待办 | 人工测试（tasks 3.4）：无活动入口、无 Solo、雷达可用、流式对话正常 |

**评审发现**：工作区混有另一条未提交 Grok subagent 工作流（14+ 文件），已确认不属于本任务并留在工作区未提交；review 期间并发写曾把 childSubagentThreads 混入 useLayoutNodes.tsx，已分离（本任务版本入库，并发改动保持 unstaged）。

**相关测试**：保留源码的隔离测试（panel/adapter/hook/utils 140 个）全部通过，应用级「不可达」期望已在 PanelTabs.test 等更新。


### Git Commits

| Hash | Message |
|------|---------|
| `7ef9151f9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1291: 为杀开关空 stub 补防御性测试

**Date**: 2026-08-02
**Task**: 为杀开关空 stub 补防御性测试
**Branch**: `cxn-version-0.7.15`

### Summary

在 buildWorkspaceSessionActivity.test.ts 增加 DISABLED_WORKSPACE_SESSION_ACTIVITY 形状与冻结断言（timeline 空、isProcessing false、Object.isFrozen），防止下线期间 stub 形状漂移复活派生链路。

### Main Changes

| 项 | 内容 |
|----|------|
| 文件 | src/features/session-activity/adapters/buildWorkspaceSessionActivity.test.ts（+24/-1） |
| 断言 | stub 与 createEmptyWorkspaceSessionActivityViewModel 形状一致；Object.isFrozen；timeline 空、isProcessing false |
| 验证 | vitest 该文件 40 用例全绿 |
| 提交 | 6e47b64ef test(session-activity): 为杀开关空 stub 补形状与冻结断言（单独提交） |


### Git Commits

| Hash | Message |
|------|---------|
| `6e47b64ef` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1292: 稳定 Shared 会话列表图标（id-first）

**Date**: 2026-08-02
**Task**: 稳定 Shared 会话列表图标（id-first）
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | Shared CLI 侧栏/Topbar/Quick Switcher 图标经常变成其他 CLI 的 EngineIcon |
| 根因 | 图标消费方仍只信可丢的 threadKind；id-first 修了 picker/send/delete 但漏迁列表图标 |
| 修复 | ThreadList / topbarSessionTabs / sessionProjection 统一 resolveIsSharedSession |
| 验证 | 63 tests（ThreadList / topbar / sessionProjection / identity）通过 |

**Updated Files**:
- `src/features/app/components/ThreadList.tsx`
- `src/features/app/components/ThreadList.test.tsx`
- `src/features/layout/hooks/topbarSessionTabs.ts`
- `src/features/layout/hooks/topbarSessionTabs.test.ts`
- `src/features/quick-switcher/sessionProjection.ts`
- `src/features/quick-switcher/sessionProjection.test.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `7caf8006f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1293: 跨引擎子代理幕布识别与会话树层级

**Date**: 2026-08-02
**Task**: 跨引擎子代理幕布识别与会话树层级
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 区域 | 说明 |
|------|------|
| 幕布识别 | Codex collab / Grok spawn_subagent / Kimi swarm / Shared 合成卡 |
| 会话树 | Grok parent_session_id、Shared native→shared parent remap、threadParentById |
| 详情抽屉 | 跨引擎 loader；过滤 launch 元数据/密文；output_file 路径兜底 Claude subagent id |
| 状态纠偏 | completion 语义 + isProcessing，避免假运行中与 0/3 |
| i18n | zh-TW/ja/ko/es/fr/ru/hi/pt-BR + locale parity 测试 |
| OpenSpec | 追溯提案 adapt-subagent-cross-engine-display；persona-ui 6.3 勾选 |

**Commit**: `7ada4675b` feat(subagent-ui): 跨引擎适配子代理幕布识别与会话树层级

**Updated Files (摘要)**:
- `src/features/subagent-ui/**`（ViewModel、识别、合成卡、详情 transcript、状态）
- `src-tauri/src/engine/grok_history.rs`
- `src/features/shared-session/runtime/sharedSessionSummaries.ts`
- `src/features/threads/hooks/*`、`activeCanvasStore`、`StatusPanel`
- `src/i18n/locales/*` + `openspec/changes/adapt-subagent-cross-engine-display/**`


### Git Commits

| Hash | Message |
|------|---------|
| `7ada4675b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
