# Journal - chenxiangning (Part 32)

> Continuation from `journal-31.md` (archived at ~2000 lines)
> Started: 2026-08-08

---



## Session 1350: 对齐 tauri plugin-dialog 版本以修复打包

**Date**: 2026-08-08
**Task**: 对齐 tauri plugin-dialog 版本以修复打包
**Branch**: `cxn-version-0.8.4`

### Summary

前端 tsc 已过；打包失败因 tauri-plugin-dialog cargo 2.6.0 vs npm 2.7.2。未升 Rust 核心（避免 tauri 2.9→2.10 连带），改为 npm 精确钉死 2.6.0。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b1e0c7851` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1351: 本地 HTML 内置浏览器打开 + OpenSpec 收口

**Date**: 2026-08-08
**Task**: 本地 HTML 内置浏览器打开 + OpenSpec 收口
**Branch**: `cxn-version-0.8.4`

### Summary

(Add summary)

### Main Changes

## 完成内容

为本地 HTML/HTM 提供「在浏览器打开」，统一走内置 Browser Agent（file://）。

| 区域 | 说明 |
|------|------|
| 入口 | 内容区右键、文件树 Globe/右键、Git Changes 行 Globe |
| 策略 | Rust 仅放行 file:// + .html/.htm；BrowserDock 保留 file:// |
| 错误 | 全局 pushErrorToast + formatOpenHtmlInBrowserError i18n |
| OpenSpec | 同步 local-html-builtin-browser-open / vibecoding-browser-agent，归档 2026-08-08 |

## 验证

- focused vitest 19 通过
- openspec validate --strict 通过

## 残留

- Browser 窗口 label 已存在时 focus+导航复用（另案）
- tab 右键未覆盖
- 工作区仍有无关 multi-agent.css 未提交改动


### Git Commits

| Hash | Message |
|------|---------|
| `daad1393c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1352: 注入上下文展开态保底高度

**Date**: 2026-08-08
**Task**: 注入上下文展开态保底高度
**Branch**: `cxn-version-0.8.4`

### Summary

修复 Inspector 注入上下文展开后短文案在 flex 侧栏被挤扁看不全：min-height + flex-shrink:0，保留 max 与 body 滚动

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c568c1b66` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1353: 抑制切换场景误报 toast

**Date**: 2026-08-08
**Task**: 抑制切换场景误报 toast
**Branch**: `cxn-version-0.8.4`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 斜杠指令 stale | orchestrator soft-cancel 不再弹「命令列表不可用」 |
| Shared 发送目标 | 切走会话 / meta ENOENT 静默；同会话真失败仍提示 |
| 验证 | vitest 相关 37 tests 通过 |
| 未纳入 | StartupGateOverlay 工作区本地改动仍未提交 |

**Updated Files**:
- `src/features/commands/hooks/useCustomCommands.ts`
- `src/features/commands/hooks/useCustomCommands.test.tsx`
- `src/features/composer/components/Composer.tsx`
- `src/features/composer/components/Composer.file-reference-token.test.tsx`
- `src/features/shared-session/target/sharedTargetPersistErrors.ts`
- `src/features/shared-session/target/sharedTargetPersistErrors.test.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `88dd0c4c2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1354: 自定义模型按供应商绑定（Claude/Codex 对称）

**Date**: 2026-08-08
**Task**: 自定义模型按供应商绑定（Claude/Codex 对称）
**Branch**: `cxn-version-0.8.4`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | `custom-model-provider-binding` proposal/design/specs/tasks 4/4 |
| 功能 | 管理弹窗前置供应商选择；三方双写 customModels+catalog；本地仅写 catalog |
| 对称 | Claude/Codex 同一录入与写盘语义；Rust `ProviderConfig.custom_models` 读写 |
| 加固 | Dialog 异步 options 不清表单；persist 错误可见；per-engine 串行 queue |
| 回归边界 | Shared/Native 开会话权威不变；Claude resolvedProviderProfileId 仍固定 null；缺省不发明 ownership |

**主要文件**:
- `src/features/vendors/customModelProviderBinding.ts`
- `src/features/vendors/persistCustomModelCatalog.ts`
- `src/features/vendors/components/CustomModelDialog.tsx`
- `src/features/vendors/components/VendorModelManagerDialogHost.tsx`
- `openspec/changes/custom-model-provider-binding/**`

**未纳入本 commit**: cold-start / hydration 相关工作区改动（他人或并行 change）仍留 working tree。


### Git Commits

| Hash | Message |
|------|---------|
| `c03428f20` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1355: 冷启 first-paint 编排闭环收口

**Date**: 2026-08-08
**Task**: 冷启 first-paint 编排闭环收口
**Branch**: `cxn-version-0.8.4`

### Summary

实现 optimize-cold-start-hydration-orchestration S0-S3+S5：冷启默认 first-paint、gate 诚实归因、full 60s 禁重扫、OpenCode 3s 预算、Overlay 诊断折叠与自动关闭恢复。实测可交互~4.4s。defer S4 git/skills 错峰与 4.4 stale apply。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a094a67ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1356: 修复工作区切换全量会话扫描

**Date**: 2026-08-09
**Task**: 修复工作区切换全量会话扫描
**Branch**: `cxn-version-0.8.5`

### Summary

移除 AppShell workspace navigation 对 exhaustive session projection summary 的依赖，改为本地 owner topology 推导；补齐回归测试、OpenSpec 与性能分析文档。自动门禁通过，用户手动切换性能验收待完成。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0f5f6ca76` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1357: 默认隐藏并按需恢复启动遮罩

**Date**: 2026-08-09
**Task**: 默认隐藏并按需恢复启动遮罩
**Branch**: `cxn-version-0.8.5`

### Summary

默认隐藏 StartupGateOverlay，并在其他设置新增默认关闭、下次启动生效的本机测试开关；同步修复 AppShell ownership catalog 与 Sidebar 本地配置测试 drift。Focused tests 101/101、typecheck、target ESLint、diff check、OpenSpec strict validation 通过；按用户明确要求未重跑 full suite。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `本次合并提交` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1358: 重构启动诊断时间轴

**Date**: 2026-08-09
**Task**: 重构启动诊断时间轴
**Branch**: `cxn-version-0.8.5`

### Summary

将启动诊断双栏改为项目感知的紧凑竖向时间轴，合并相同操作并展示次数、耗时和语义说明；保留原始一键复制诊断内容，未纳入并行冷启动与临时调试改动。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `db8b3c308` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1359: 根治冷启点击卡死

**Date**: 2026-08-09
**Task**: 根治冷启点击卡死
**Branch**: `cxn-version-0.8.5`

### Summary

回滚延长 input-ready 的 S7 全局 barrier；收敛 startup diagnostic 单通道 ownership，StartupGate 改为 1Hz summary、点击冻结 snapshot、按需复制并保持 manual-only；Codex first-page 与 renderer diagnostics 使用有界工作预算。人工冷启验收通过；focused Vitest 138/138、target ESLint、typecheck、runtime contracts、OpenSpec strict validate 通过，按要求未跑全量测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3c3ac3f08` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1360: 合并 upstream 0.8.5 更新

**Date**: 2026-08-09
**Task**: 合并 upstream 0.8.5 更新
**Branch**: `cxn-version-0.8.5`

### Summary

将 upstream/chore/bump-version-0.8.5 的 6 个提交语义合并到 cxn-version-0.8.5，零冲突并保留本地冷启修复与上游 Vendor/Settings/Git 能力。同步 @codemirror/lint 6.9.7；修正上游遗漏的 VendorSettingsPanel help popover 陈旧断言。typecheck、runtime contracts、targeted ESLint 通过；定向测试原 61 项通过，修正后的唯一失败用例单测通过。未跑全量测试，未拉起 App，未 push。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c4c382832` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1361: Sub2API/New API 中转额度查询与 HUD 展示

**Date**: 2026-08-10
**Task**: Sub2API/New API 中转额度查询与 HUD 展示
**Branch**: `cxn-version-0.8.6`

### Summary

未知中转站额度：Sub2API /v1/usage 优先、失败回退 New API /api/user/self；Grok local 读 config.toml；HUD 多行用量；供应商 {origin} {source}；友好错误与超时优化

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e9da94dff` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1362: fix(startup): platform-split CSS 写入策略, 兼容 macOS/Windows 冷启点击卡死

**Date**: 2026-08-10
**Task**: fix(startup): platform-split CSS 写入策略, 兼容 macOS/Windows 冷启点击卡死
**Branch**: `cxn-version-0.8.6`

### Summary

e0ddd9e99 的零 CSS 写入修复了 Windows Blink compositor 阻塞, 但导致 macOS WKWebView CSSOM 懒加载未初始化——首次点击触发同步 layout 死锁。终局方案: applyUiScale 内按 rendererPlatform 分块, macOS 走无条件写入, Windows 走残留清除。4 files, +209/-63。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `26d07de4a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1363: 修复!提示词 soft-failure 永久空态

**Date**: 2026-08-10
**Task**: 修复!提示词 soft-failure 永久空态
**Branch**: `cxn-version-0.8.6`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| OpenSpec | `fix-custom-prompts-stale-empty-cache`（proposal/design/tasks/specs/verification） |
| 根因 | idle-prewarm soft-fail 把 `[]` stamp 为权威拉取，`!` 只读内存永不重试 |
| 修复 | soft-cancel 保留缓存；硬失败可重试+toast；shared inFlight；`!` 空态 on-demand revalidate（skipIfAuthoritative） |
| 测试 | useCustomPrompts + ChatInputBoxAdapter 70 passed |

**Updated Files**:
- `src/features/prompts/hooks/useCustomPrompts.ts`
- `src/features/prompts/promptEvents.ts`
- `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
- `openspec/changes/fix-custom-prompts-stale-empty-cache/**`


### Git Commits

| Hash | Message |
|------|---------|
| `0e2411c08` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1364: 项目记忆 Grok/Kimi 与 Shared 整轮写入

**Date**: 2026-08-10
**Task**: 项目记忆 Grok/Kimi 与 Shared 整轮写入
**Branch**: `cxn-version-0.8.6`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 任务1 | Native Grok/Kimi/Gemini TurnCompleted 始终发 text-lane item/completed，完整 conversation_turn 融合 |
| 任务2 | Shared V2/V1 captureTurnInput；terminal 投影后触发 onAgentMessageCompleted |
| OpenSpec | fix-grok-kimi-native-memory-completion、add-shared-session-project-memory-capture |
| 提交策略 | 剥离 collab 主幕 inject 污染，仅提交记忆相关 18 文件 |

**Updated Files**:
- src-tauri/src/engine/commands.rs / commands_tests.rs
- src-tauri/src/bin/cc_gui_daemon.rs / daemon_state.rs
- src/features/app/hooks/useAppServerEvents.ts(+test)
- src/features/threads/hooks/useThreadMessaging.ts(+tests)
- openspec/changes/fix-grok-kimi-native-memory-completion/**
- openspec/changes/add-shared-session-project-memory-capture/**


### Git Commits

| Hash | Message |
|------|---------|
| `1c2e84190` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1365: 协作首段注入主幕对话上下文

**Date**: 2026-08-10
**Task**: 协作首段注入主幕对话上下文
**Branch**: `cxn-version-0.8.6`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| OpenSpec | `add-collab-first-stage-main-canvas-context` |
| 能力 | 主幕触发协作时，首段 model text 头部注入主幕已有对话 digest |
| 显示 | 主幕卡标题用 userVisibleText；右栏注入上下文增加「主幕对话上下文」分区 |
| 验证 | UI 验收通过；注入链路 requestText→首段 prompt 已核对；focused Vitest 通过 |

**Updated Files**:
- `src/features/multi-agent/runtime/mainCanvasContextInjection.ts`
- `src/features/threads/hooks/useThreadMessaging.ts`
- `src/features/multi-agent/components/HistoryFoldCard.tsx`
- `src/features/multi-agent/utils/buildStageInjectContext.ts`
- `openspec/changes/add-collab-first-stage-main-canvas-context/**`


### Git Commits

| Hash | Message |
|------|---------|
| `037f9e148` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1366: Shared 子代理 parent-id 改挂收口

**Date**: 2026-08-10
**Task**: Shared 子代理 parent-id 改挂收口
**Branch**: `bump-version-0.8.7`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| OpenSpec | `enhance-shared-subagent-parent-id-attach`（proposal/design/specs/tasks） |
| 问题 | Shared×Codex 子代理 parent 指向 hidden native owner 后升顶层根（下崽） |
| 方案 | 引擎无关 `lookupSharedOwnerByNativeParent`（raw / engine: 变体）；不扩大 hide、不删行 |
| 接入 | list 主路径 / Grok merge / Kimi 异步 / sidebarInternals live 子树 |
| 验证 | unit 43 + useThreadActions 集成测 1；openspec validate strict 通过 |

**Updated Files**:
- `src/features/shared-session/runtime/sharedSessionSummaries.ts`
- `src/features/shared-session/runtime/sharedSessionSummaries.test.ts`
- `src/features/threads/hooks/useThreadActions.ts`
- `src/features/threads/hooks/useThreadActions.helpers.ts`
- `src/features/threads/hooks/useThreadActions.shared-subagent-parent.test.tsx`
- `src/features/app/components/sidebarInternals.ts`
- `openspec/changes/enhance-shared-subagent-parent-id-attach/**`


### Git Commits

| Hash | Message |
|------|---------|
| `2f45c4c34` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1367: 纠偏：侧栏隐藏 Shared 下崽

**Date**: 2026-08-10
**Task**: 纠偏：侧栏隐藏 Shared 下崽
**Branch**: `bump-version-0.8.7`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 纠偏 | 用户要的是侧栏隐藏崽子，不是只改挂 |
| 动作 | useThreadRows + isSharedSidebarHiddenPup（parent-id） |
| 边界 | store 保留 → 幕布/Strip 不扩散；Native 树不变 |


### Git Commits

| Hash | Message |
|------|---------|
| `9bf25cf46` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1368: 记忆挑选闸门 Phase-1 全量提交

**Date**: 2026-08-10
**Task**: 记忆挑选闸门 Phase-1 全量提交
**Branch**: `bump-version-0.8.7`

### Summary

(Add summary)

### Main Changes

| 维度 | 内容 |
|------|------|
| 功能 | 发送前 Memory Pick Gate：Native/Shared/Collab 统一 pick/always 编排 |
| always | 预勾 n（默 3）可改、读秒 8s、记住 preferredCount |
| UI | C 布局、portal 详情 Markdown、icon 底栏、固定 36px 行高 |
| 标题 | strip project-memory-pack |
| Composer | 幕布模式同步菜单；文案对齐 |
| 文档 | openspec add-memory-pick-gate 二次回写 |
| 测试 | 81 项 memory-pick 相关 vitest 全过 |

**Updated paths (摘要)**:
- `src/features/project-memory/memoryPick/**`
- `src/features/project-memory/components/MemoryPickGate*.tsx`
- `src/features/threads/hooks/useThreadMessaging.ts`
- `src/styles/memory-pick-gate.css`
- `openspec/changes/add-memory-pick-gate/**`


### Git Commits

| Hash | Message |
|------|---------|
| `89b0d025a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1369: 记忆匹配态 logo 与 1s 最短展示

**Date**: 2026-08-10
**Task**: 记忆匹配态 logo 与 1s 最短展示
**Branch**: `bump-version-0.8.7`

### Summary

匹配 UI 改用项目 logo（assets/icon.png）+ 呼吸动画；PICK_MATCH_MIN_DISPLAY_MS=1000；相关单测已同步。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `30bb1fe62` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1370: memory-pick always 自动确认与顶栏 UI 校准

**Date**: 2026-08-10
**Task**: memory-pick always 自动确认与顶栏 UI 校准
**Branch**: `bump-version-0.8.7`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 自动确认 | 仅闸门以 always 进入 awaiting 时武装 8s 读秒；中途 pick→always 不启动 |
| 打断 | 勾选/详情/取消/切 mode/skip/dismiss 打断后本轮不重启 |
| UI | 策略菜单虚线框；顶栏强制单行 + ellipsis；count.always / alwaysCountdown 拆分 |
| 文档 | 同步 OpenSpec design/spec/ux/proposal/README |
| 测试 | MemoryPickGate.test.tsx 11/11 通过 |

**Updated Files**:
- `src/features/project-memory/components/MemoryPickGate.tsx`
- `src/styles/memory-pick-gate.css`
- `src/i18n/locales/zh/memory.ts` / `en/memory.ts`
- `openspec/changes/add-memory-pick-gate/**`


### Git Commits

| Hash | Message |
|------|---------|
| `76c3f3158` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1371: memory-pick Phase-2 hybrid 检索与可感注入转接

**Date**: 2026-08-10
**Task**: memory-pick Phase-2 hybrid 检索与可感注入转接
**Branch**: `bump-version-0.8.7`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 检索 | memoryRetrieveKernel：lexical + 可选 semantic/hybrid，诚实 retrievalMode |
| 可感 | emptyReason → 主幕时间线 status（【记忆参考状态】），非全局 toast |
| 埋点 | memoryPickTelemetry 白名单禁正文 |
| 语义转接 | Pack Instruction Primary/REFERENCE/UNTRUSTED；Cleaner 导语；preview 为本轮提问参考 |
| UI | 闸门/空结果中性色；列表高度收口 |
| 文档 | OpenSpec enhance-memory-pick-retrieval-and-observability + research 06 |
| 采集 | ABCD 路径零改动 |
| 验收 | 相关 vitest 84 passed；用户手测通过 |

**Updated Files**（主路径）:
- `src/features/project-memory/memoryPick/memoryRetrieveKernel.ts`
- `src/features/project-memory/memoryPick/memoryPickTelemetry.ts`
- `src/features/project-memory/utils/projectMemoryRetrievalPack.ts`
- `src/features/threads/hooks/useThreadMessaging.ts`
- `openspec/changes/enhance-memory-pick-retrieval-and-observability/**`


### Git Commits

| Hash | Message |
|------|---------|
| `af112cdde` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
