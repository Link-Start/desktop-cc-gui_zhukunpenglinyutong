# Journal - chenxiangning (Part 31)

> Continuation from `journal-30.md` (archived at ~2000 lines)
> Started: 2026-08-03

---



## Session 1300: Codex 续接过滤 control 角色

**Date**: 2026-08-03
**Task**: Codex 续接过滤 control 角色
**Branch**: `cxn-version-0.7.15`

### Summary

codex_import_projection 不再 inject control 消息，避免 DeepSeek 等兼容 API invalid_request_error

### Main Changes

用户：本地 Codex 续接 DeepSeek-codex 后对话失败（control variant）。
已在 codex_import_projection 过滤非 portable message roles。


### Git Commits

| Hash | Message |
|------|---------|
| `c2c45e269` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1301: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏

**Date**: 2026-08-03
**Task**: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏
**Branch**: `cxn-version-0.7.15`

### Summary

onDebugRef 解耦、原子 selection state、乐观 snapshot、preferred 归一、epoch 熔断、playbook 追加 C-20260803-01

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2974b721e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1302: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏

**Date**: 2026-08-03
**Task**: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏
**Branch**: `cxn-version-0.7.15`

### Summary

onDebugRef 解耦、原子 selection state、乐观 snapshot、preferred 归一、epoch 熔断、playbook 追加 C-20260803-01

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d4806464c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1303: fix shortcuts guide Quick Switcher i18n key

**Date**: 2026-08-03
**Task**: fix shortcuts guide Quick Switcher i18n key
**Branch**: `cxn-version-0.7.15`

### Summary

快捷键指南误用 sidebar.quickSwitcher.title，改为 quickSwitcher.title；仅提交 2 个文件，未混入其他 WIP。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d2537a77b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1304: 修复 Codex 死 thread 恢复卡 Fork 静默失败

**Date**: 2026-08-03
**Task**: 修复 Codex 死 thread 恢复卡 Fork 静默失败
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | `fix-codex-stale-dead-thread-fork-continuation` |
| 问题 | 老 Codex 会话 `thread not found` 时点 Fork 无效（native fork 死父 + 静默 null） |
| 修复 | 恢复卡 Fork 走 `continueStaleThreadBindingForManualRecovery`：fork→fresh，失败可见 |
| 验证 | openspec validate ✅；recovery+runtime-reconnect 53 passed |

**Updated Files**:
- `src/app-shell-parts/manualThreadRecovery.ts`
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- `src/features/messages/components/recovery/RuntimeReconnectCard.tsx`
- `openspec/changes/fix-codex-stale-dead-thread-fork-continuation/**`


### Git Commits

| Hash | Message |
|------|---------|
| `76951f6e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1305: 修复 Shared Claude AskUserQuestion 弹窗与超时体验

**Date**: 2026-08-03
**Task**: 修复 Shared Claude AskUserQuestion 弹窗与超时体验
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 根因 | Shared control owner 校验时 Claude RequestUserInput 的 turnId 与 runtimeTurnId 不一致，提问事件被静默丢弃 |
| 修复 | events 映射用 turn_id_context；projection 对 control 方法强制对齐 turnId；OpenSpec change 收口 |
| 体验 | 超时 5→30 分钟，超时默认选推荐首项；提交后本地立即收起 live 卡；倒计时前展示超时说明 |
| 验证 | 用户手测弹窗通过；Vitest 44 通过；cargo MCP timeout 相关测试通过 |

**Updated Files**:
- `src-tauri/src/engine/events.rs`
- `src-tauri/src/shared_runtime_coordinator.rs`
- `src-tauri/src/engine/claude/user_input.rs`
- `src/features/app/components/RequestUserInputMessage.tsx`
- `src/features/app/components/UserInputQuestionCard.tsx`
- `src/features/app/components/userInputTimeout.ts`
- `openspec/changes/fix-shared-session-askuserquestion-control-owner/**`


### Git Commits

| Hash | Message |
|------|---------|
| `87836b7cb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1306: 适配 Shared MCP AskUserQuestion 工具卡 UI

**Date**: 2026-08-03
**Task**: 适配 Shared MCP AskUserQuestion 工具卡 UI
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | Shared CLI 将 mcp__ccgui__AskUserQuestion 当通用 MCP 渲染，展示 raw QUESTIONS/_input/_output |
| 修复 | extractToolName/isMcpTool 识别；McpToolBlock 专用展示；完成态归一 requestUserInputSubmitted |
| 验证 | 用户验收通过；相关单测 124 通过 |

**Updated Files**:
- `src/features/messages/components/toolBlocks/McpToolBlock.tsx`
- `src/utils/threadItemsAskUserQuestion.ts`
- `src/utils/toolSemantics.ts`
- `src/features/messages/components/toolBlocks/toolConstants.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `7c40eaaab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1307: OpenSpec 批量归档已验证提案

**Date**: 2026-08-03
**Task**: OpenSpec 批量归档已验证提案
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 归档 | 7 个 verified/已验收 change → `archive/2026-08-03-*` |
| Spec sync | 新建 5 个 capability + 修改多个既有 main specs |
| 索引 | 重建 `changes/README`、`specs/README`，更新 `archive/README`、`project.md` |

**归档清单**:
- add-atlas-cloud-codex-preset
- close-native-session-provider-create-binding
- default-collapse-workspace-actions-menu
- fix-linux-startup-preserve-baidu-analytics
- honor-native-session-renamed-titles
- grok-cli-image-input-capability-gap
- enhance-subagent-canvas-persona-ui

**库存**: active=58, archive=791, main specs=462

**后续**: complete 但无 verification 的 active 可作下一波 archive；有 archive block 的 verification 提案暂留


### Git Commits

| Hash | Message |
|------|---------|
| `d8bc34a6f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1308: OpenSpec 第二波 bulk archive 37 complete 提案

**Date**: 2026-08-03
**Task**: OpenSpec 第二波 bulk archive 37 complete 提案
**Branch**: `CXN-version-0.7.16`

### Summary

归档 37 个 complete/archive-ready OpenSpec changes 到 2026-08-03；时间序同步 main specs；active 剩余 21（blocked/manual gates）；archive=828 specs=481

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a8cd3f2f9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1309: OpenSpec 第三波：归档已上线人工 residual 提案

**Date**: 2026-08-03
**Task**: OpenSpec 第三波：归档已上线人工 residual 提案
**Branch**: `CXN-version-0.7.16`

### Summary

归档 20 个 shipped+manual residual active changes；active 仅剩 add-linux-native-menu-localization；archive=848 specs=492

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5192d03df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1310: Codex collab 子代理 live 与 history 呈现对齐

**Date**: 2026-08-03
**Task**: Codex collab 子代理 live 与 history 呈现对齐
**Branch**: `CXN-version-0.7.16`

### Summary

修复 Codex multi-agent 实时 wait 阶段幕布/Status 缺子代理呈现；engine-gate 隔离其他 CLI；仅提交本任务相关文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b725e011e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1311: Shared 队列 pending-ack UI 标识

**Date**: 2026-08-03
**Task**: Shared 队列 pending-ack UI 标识
**Branch**: `CXN-version-0.7.16`

### Summary

队列 pending-ack 显示「已发送，确认中（防重复）」；不改防双发出队逻辑；仅提交 composer/i18n 相关文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1a6f7ea4a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1312: 文档信息架构治理

**Date**: 2026-08-03
**Task**: 文档信息架构治理
**Branch**: `CXN-version-0.7.16`

### Summary

重构 docs 信息架构与索引，统一 139 份文档 lifecycle metadata，归档废弃内容，新增文档治理 gate 与 CI 检查，并修复 review 发现的语义漂移。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `64b7a817f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1313: 收录轨道路由 Logo 示例

**Date**: 2026-08-03
**Task**: 收录轨道路由 Logo 示例
**Branch**: `CXN-version-0.7.16`

### Summary

将 9 个轨道路由 Logo 示例从临时 output 目录移动至 docs/assets/logo-concepts/orbit-routing，并作为文档设计资产提交。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `22164e20e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1314: 跨平台应用图标切换

**Date**: 2026-08-04
**Task**: 跨平台应用图标切换
**Branch**: `CXN-version-0.7.16`

### Summary

外观设置增加应用图标选择（默认+orbit-routing）；macOS Dock / Win-Linux 窗口任务栏；联动 About/锁屏；边界加固后提交

### Main Changes

| 能力 | 说明 |
|------|------|
| 设置 UI | 外观页单行图标轨 + 左右 chevron，无原生滚动条 |
| 持久化 | AppSettings.dockIconId，非法 id 回退 default |
| macOS | NSApplication.setApplicationIconImage，默认也走 PNG bytes |
| Win/Linux | Window.set_icon 遍历已开窗口；About/explorer 二次 reapply |
| 边界 | PNG magic 校验、4MB 上限、快速切换 generation 丢弃、Uint8Array IPC |

**Updated Files** (核心):
- `src/features/theme/utils/dockIcon.ts`
- `src-tauri/src/window.rs`
- `src/features/settings/.../BasicAppearanceSection.tsx`
- `src/assets/dock-icons/**`


### Git Commits

| Hash | Message |
|------|---------|
| `f3d57fac7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1315: 修复 dockIcon 测试 tsc 错误

**Date**: 2026-08-04
**Task**: 修复 dockIcon 测试 tsc 错误
**Branch**: `CXN-version-0.7.16`

### Summary

修复 dockIcon.test.ts 中 resolveFetch 推断为 never 导致 mac-arm64 构建失败

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8cfa50e6f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1316: 修复 Shared 侧栏异步刷新 stale hide set 泄漏原生会话

**Date**: 2026-08-04
**Task**: 修复 Shared 侧栏异步刷新 stale hide set 泄漏原生会话
**Branch**: `CXN-version-0.7.16`

### Summary

异步 Grok/Kimi/Gemini refresh 重建 hide set 并 purge baseline 泄漏；补齐 OpenSpec 变更 fix-shared-sidebar-hide-set-staleness；typecheck/lint/36 测试全绿

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e0f8c0aa7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1317: 闭环 Shared 恢复出口

**Date**: 2026-08-04
**Task**: 闭环 Shared 恢复出口
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | `fix-shared-session-recovery-exit-closure` |
| P0 | Recovery Exit Ladder：Probe / Stop / 停止并重建 / 放弃本轮 |
| P0 | `target-unavailable` 分类纠偏；abandon durable + 清 binding recovery |
| P1 | force-stop 先读 settled 再 remove（防丢已完成回答） |
| P1 | 融合禁用原因 `fuseDisabledReasonKey` + 网关类 toast |
| 收尾 | 删死 key、补 `--danger` CSS、`__details` class |

**验证**：OpenSpec validate strict；FE SharedSend/MessageQueue/locale；Rust abandon + remove_attempt settled 契约测试。

**未提交残留**：`.trellis` 旧脏文件、`fix-shared-sidebar-hide-set-staleness/tasks.md` 未纳入本 commit。


### Git Commits

| Hash | Message |
|------|---------|
| `c4cb33daf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1318: docs: 重写新 CLI 接入指南, 补全量注册点核对矩阵 A~H 八层 56 行

**Date**: 2026-08-04
**Task**: docs: 重写新 CLI 接入指南, 补全量注册点核对矩阵 A~H 八层 56 行
**Branch**: `CXN-version-0.7.16`

### Summary

基于全仓库 40+ 真实注册点盘点, 重写 mossx-new-cli-onboarding-guide.md; 补 AGENTS.md Engine Onboarding Gate + guides/index.md 触发信号

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f6858e821` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
