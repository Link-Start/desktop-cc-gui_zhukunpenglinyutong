## Why

当前 native `Close Window` accelerator 会先于 WebView 截获 `Cmd/Ctrl+W`，导致 file editor 的扩大选择无法执行；同时 code navigation 将 backend English error 直接展示给用户，且 `Cmd/Ctrl+Click` 缺少可点击反馈。这三处问题共同降低了 editor navigation 的可发现性与可解释性。

## 目标与边界

- 让 file editor 内的 platform-primary `Cmd/Ctrl+W` 优先扩大语法选择，同时保留菜单点击关闭窗口与 editor 外关闭当前会话行为。
- 将 definition、implementation、references 的无 symbol/unsupported 等预期失败转换为 action-specific localized guidance。
- 按住 platform-primary modifier 时，仅对可导航 identifier 提供 underline + pointer affordance，并在 modifier/mouse/window 状态结束时清理。

## What Changes

- native File/Window menu 的 `Close Window` 改为无 accelerator 的 custom item，点击行为不变。
- expand-selection 默认改为 shared platform-primary `cmd+w` 语义；CodeMirror editor-scoped keymap 继续先于 global close-session handler 消费事件。
- code navigation 根据 action 分类用户提示，不再把 `No symbol under cursor` 等 backend raw English 直接透传到 UI。
- CodeMirror 增加 modifier-hover symbol decoration；只做本地 syntax/identifier 判断，不在 mousemove 中触发 LSP query。
- 增加快捷键冲突、错误语义与 modifier hover lifecycle 的 focused regression tests。

## 非目标

- 不改变 definition/references/implementation backend 搜索算法或 LSP provider。
- 不取消“关闭当前会话”的 configurable shortcut，也不改变 editor 外行为。
- 不通过 hover 预请求 definition，不增加新依赖。

## 方案对比与取舍

1. **推荐：移除 native close accelerator，由 editor-scoped keymap 与现有 DOM shortcut dispatcher 分层处理。** 保留菜单功能，修复 native 事件抢占，改动最小且跨平台一致。
2. 在 native menu event 中检测 editor focus 后转发。native menu handler 无可靠 CodeMirror selection context，需要新增跨 WebView 状态同步，复杂且容易 stale，放弃。
3. modifier hover 时实时请求 LSP。准确率高但会制造 mousemove request storm、缓存抖动与 UI latency，放弃；本轮采用 syntax-tree identifier affordance，点击后仍由现有 navigation request 给出权威结果。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `app-shortcuts`: 修改 expand-selection 与 native close accelerator 的 precedence contract。
- `file-view-code-intelligence-navigation`: 增加 action-specific localized failure guidance 与 modifier-hover navigation affordance。

## 验收标准

- macOS file editor 内 `Cmd+W`、Windows/Linux file editor 内 `Ctrl+W` 扩大语法选择且窗口不关闭。
- editor 外 configured close-current-session shortcut 仍生效；File/Window menu 点击仍能关闭窗口，但不显示 `Cmd/Ctrl+W` accelerator。
- 三个 navigation action 在非 symbol 位置给出对应的本地化操作指导，infra/timeout error 仍可区分。
- 按住 modifier 悬停 identifier 时出现 underline + pointer；松键、移出或失焦后清理；comments/strings/whitespace 不误标。
- focused frontend/Rust tests、typecheck、incremental lint 与 strict OpenSpec validation 通过；不运行全量测试。

## Impact

- Rust native menu：`src-tauri/src/menu.rs`
- Frontend editor/navigation：`src/features/files/components/FileCodeMirrorEditorImpl.tsx`、`src/features/files/hooks/useFileNavigation.ts`
- Shared shortcut defaults/persistence：frontend settings 与 `src-tauri/src/types.rs`
- UI copy：`src/i18n/locales/*/files.ts`、settings shortcut labels/tests
- 无新增 dependency，无 IPC payload shape 变化。
