# Verification

## 结论

本 change 的实现、focused regression 与 pre-commit review closure 已完成；用户已明确授权通过门禁后整体提交。实现链路为：

`file/conversation surface -> NoteCaptureDraft -> layout-owned monotonic request -> note workbench create mode -> Tauri create mapping -> Rust JSON storage`

捕获请求只存在于低频 layout owner，不进入 conversation reducer、streaming delta 或 AppShell 高频 store。

本轮 follow-up 新增：

`saved code source action -> typed onOpenCodeSource -> layout owner -> onActiveEditorLineRangeChange + onOpenFile`

note panel 不读取 filesystem；creating/editing source 保持只读，避免绕过 dirty guard。只读 detail 给既有 `Markdown` 传入 `codeBlockStyle="message"` 与 `workspaceId`，新 code capture body 收敛为 fence-only；历史 note 不迁移、不重写。

## 已通过

- `pnpm vitest run <9 focused files>`：9 files / 61 tests passed。
- `pnpm vitest run src/features/files/components/FileViewPanel.test.tsx`：66 tests passed。
- `pnpm vitest run src/features/messages/components/Messages.test.tsx src/features/messages/hooks/useFileLinkOpener.test.tsx`：35 passed / 2 skipped。
- `pnpm lint`：passed，无 warning。
- `pnpm typecheck`：passed。
- `git diff --check`：passed。
- `pnpm check:runtime-contracts`：passed。
- `pnpm doctor:strict`：passed。
- `pnpm check:large-files`：command passed；report 中 49 个 oversized files 属于现有 baseline，本 change 未新增大文件。
- `cargo check -q --lib`：passed，仅有现存 dead-code warnings。
- `openspec validate unify-source-aware-note-capture-workbench --strict`：passed。

### 2026-07-19 Source Navigation / Rich Code Follow-up

- `pnpm vitest run <10 focused files>`：10 files / 70 tests passed，覆盖 source callback、layout path/location/range routing、fence-only body、Markdown renderer props、conversation non-navigation 与 locale parity。
- `pnpm vitest run src/features/files/components/FileViewPanel.test.tsx src/features/messages/components/Messages.test.tsx src/features/messages/components/Markdown.file-links.test.tsx`：113 passed / 2 skipped。
- `pnpm build`：passed；仅保留仓库已有 dynamic import/chunk-size warnings。
- `pnpm lint`：passed，0 warning。
- `pnpm typecheck`：passed。
- `pnpm check:runtime-contracts`：passed。
- `pnpm doctor:strict`：passed。
- `pnpm check:large-files`：command passed；49 个 report entries 属于仓库现有 baseline，本 follow-up 未新增文件。
- `git diff --check`：passed。
- `openspec validate unify-source-aware-note-capture-workbench --strict --no-interactive`：passed。

### 2026-07-19 Workbench Layout Maximize Follow-up

- 实现证据：
  - `WorkspaceNoteCardsLayoutContext.tsx` 提供 feature-local controlled context/controller；provider 缺失时 panel 不暴露不可执行 action。
  - `DesktopLayout.tsx` 持有 transient maximize state；maximized conversation 保持 mounted，但同步 `is-hidden`、`aria-hidden` 与 `inert`，split divider 不渲染。
  - `main.css` 只将 note layer 扩展为中央区域 `flex: 1 1 100%`；right panel/main topbar 不在 selector 作用域。
  - `WorkspaceNoteCardPanel.tsx` 复用 `menu.maximize` / `common.restore` 与 Lucide `Maximize2/Minimize2`，无新增 dependency/i18n key。
- `pnpm vitest run DesktopLayout.test.tsx WorkspaceNoteCardPanel.test.tsx WorkspaceNoteCardPanel.maximize.test.tsx`：3 files / 31 tests passed。
- `pnpm vitest run <11 focused files>`：11 files / 83 tests passed。
- 相邻 UI regression：3 files / 113 passed / 2 skipped。
- `WorkspaceEditableDiffCompare.test.tsx` isolated：9/9 passed；同原 batch isolated：38/38 passed。
- `pnpm lint`：passed，0 warning。
- `pnpm typecheck`：passed。
- `pnpm build`：passed；仅保留仓库已有 dynamic import/chunk-size warnings。
- `cargo check --lib`：passed；仅保留仓库已有 dead-code warnings。
- `pnpm check:runtime-contracts`、`pnpm doctor:strict`：passed。
- `pnpm check:large-files`：command passed；一次中间实现曾将 report 从 49 增到 51，拆分 controller/test 后恢复既有 49，本 follow-up 最终未新增 baseline。
- `git diff --check`：passed。
- `openspec validate unify-source-aware-note-capture-workbench --strict --no-interactive`：passed。
- `pnpm test`：默认 852 files batching 在 81/213 被无关 `WorkspaceEditableDiffCompare` baseline recovery 时序波动中止；该文件单独与原四文件 batch 立即重跑均通过，且本 follow-up 未修改相关实现/测试。

### 2026-07-19 Source Navigation Companion Follow-up

- 实现证据：
  - saved code note 的 source action 显式传入 `editorSplitCompanion: "notes"`；普通 file tree、search、message 与 Git file-open 继续使用既有 `chat` / `projectMap` companion。
  - `WorkspaceNoteCardPanel` 在 notes center 与 Editor companion 之间保持同一 mounted instance；Editor file maximize 只对 note layer 设置 hidden/inert，restore 后 selected note 与 draft 仍在。
  - 关闭最后一个 Editor tab 或显式退出 Editor 时返回 notes；workspace switch 会将 stale notes companion 复位为 chat，避免跨 workspace 泄漏。
  - notes companion 强制使用 notes-left/editor-center 的 horizontal presentation，但不覆写用户持久化的普通 Editor split preference；right panel 保持原 ownership。
  - maximize action 仅在 notes center 可用，Editor companion 中不显示，避免与 Editor maximize 形成双 owner 冲突。
- `pnpm vitest run useGitPanelController.test.tsx DesktopLayout.test.tsx useLayoutNodes.client-ui-visibility.test.tsx WorkspaceNoteCardPanel.maximize.test.tsx`：4 files / 79 tests passed。
- 扩展 focused regression：15 files / 231 passed / 2 skipped；覆盖 note capture、source navigation、Markdown/code rendering、conversation selection、Tauri mapping 与 locale parity。
- `pnpm lint`：passed，0 warning。
- `pnpm typecheck`：passed。
- `pnpm build`：passed；仅保留仓库已有 dynamic import/chunk-size warnings。
- `pnpm check:runtime-contracts`、`pnpm doctor:strict`：passed。
- `pnpm check:large-files`：command passed；report 保持仓库既有 49 entries，本 follow-up 未新增 baseline。
- `cargo check --lib`：passed；仅保留仓库已有 dead-code warnings。
- `git diff --check`：passed。
- `openspec validate unify-source-aware-note-capture-workbench --strict --no-interactive`：passed。
- `pnpm test`：默认 852 files batching 在 145/213 被无关 `SettingsView.test.tsx` 旧文案断言中止；此前本 change 相关批次均通过，且本轮 `WorkspaceEditableDiffCompare.test.tsx` 9/9 通过。

### 2026-07-19 Pre-Commit Review Closure

- 评审根因修复：
  - `buildCodeSelectionNoteDraft` 只用 `trim()` 判空，fenced body 使用 canonical selection 原文，leading indentation 与 trailing newline 不再被改写。
  - `EditorNavigationLocation` 增加 optional `endLine`；saved source action 不再提前发布 active range，而是将完整 range 随 navigation target 传到目标文件。
  - 目标文件加载完成且 CodeMirror view 可用后，同一 transaction 设置 selection 与 centered scroll；普通 navigation 未提供 `endLine` 时保持 single-cursor behavior，过期 end line clamp 到当前文档末行。
  - `src-tauri/src/note_cards.rs` 的本 change formatting 已按单文件 `rustfmt` 收口，未格式化或改写无关 Rust 文件。
- `pnpm vitest run <13 focused files>`：13 files / 130 tests passed，覆盖正文原文保真、source routing、controller target、CodeMirror range restore、shortened-document clamp、workbench/layout、conversation、Tauri mapping 与 locale parity。
- 相邻回归 `FileViewPanel.test.tsx`、`Messages.test.tsx`、`Markdown.file-links.test.tsx`：113 passed / 2 skipped。
- `pnpm test`：默认 852 files batching 前 144/213 batches 全部通过；batch 145 在已知无关 `SettingsView.test.tsx` 旧文案 `Client UI visibility` 断言停止。本 change 的 controller、CodeMirror、FileView capture/panel、layout、Messages、note panel/builder 默认批次均已通过。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`：passed；build 仅保留仓库既有 dynamic import/chunk-size warnings。
- `pnpm doctor:strict`：passed，包含 runtime contract、branding 与 doctor gate。
- `pnpm check:large-files`：command passed；report 维持仓库既有 49 entries。
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`：passed，仅保留仓库已有 2 个 dead-code warnings。
- `rustfmt --edition 2021 --check src-tauri/src/note_cards.rs`、`git diff --check`：passed。
- `cargo test --manifest-path src-tauri/Cargo.toml note_cards::tests --lib`：仍被无关 `src/vendors/kimi_providers.rs:649` 缺少 `HashMap` import 阻塞，与既有基线一致。
- `openspec validate unify-source-aware-note-capture-workbench --strict --no-interactive`：passed。

## 仓库现有阻塞

`pnpm test` 按默认 851 test files 分批执行。本 change 相关批次与相邻回归均通过；全仓扫描发现以下可独立复现、且本 change 未修改对应路径的现有失败：

1. `src/features/settings/components/SettingsView.test.tsx`
   - `persists client UI visibility panel and control toggles`
   - 期望旧文案 `Client UI visibility`，当前 render 中不存在。
2. `src/features/status-panel/components/StatusPanel.test.tsx`
   - `generates commit message from selected checkpoint commit files`
   - `git.generateCommitMessageEngineClaude` 当前出现两个匹配节点。
3. `src/features/vendors/components/ProviderDialog.presets.test.tsx`
   - fixture 期望 `Moonshot`，当前 icon title 为 `MoonshotAI`。
4. `src/features/workspaces/components/WorkspaceHome.test.tsx`
   - mock 未导出 `TASK_RUN_STORE_UPDATED_EVENT`，7 tests 在 mount 时失败。
5. `src/styles/git-diff-visual-contract.test.ts`
   - contract 期望 `overflow-y: auto`，当前 CSS 为 `overflow-y: hidden`。

`cargo test note_cards::tests --lib` 在编译测试 target 时被无关模块阻塞：

- `src/vendors/kimi_providers.rs:649`
- test module 缺少 `use std::collections::HashMap;`

为避免扩大本 change 范围，没有修改上述无关模块。

## 用户手工验收

- CodeMirror 编辑态选择单行/多行后右键：打开便签创建态，正文、language、path、line range 正确。
- 代码预览态选择逻辑行后右键：结果与编辑态一致；空白右键不显示无效保存动作。
- 对话局部文本选择后右键：Copy 与“保存选中正文”使用右键瞬间冻结的同一份文本。
- 对话空白区域右键保存整体正文：只包含 user、final assistant、completed diff/review；不包含 reasoning、tool、control、live assistant。
- 普通打开便签：默认不显示输入框；选择便签先只读，点击编辑后才进入 editor。
- 新建/捕获：进入 creating；保存后回到只读详情；archive 中保持只读。
- 缩窄窗口检查 Master-Detail 不重叠，source summary 可读。
- 打开已保存 code note，点击“采集来源”：切换到对应文件、start line 居中并恢复 captured line range。
- 创建/编辑中的 code source 仅显示 summary，不允许跳转导致未保存草稿丢失。
- code detail 显示 language badge、syntax highlighting、line numbers 与 copy action；新 capture 正文不再重复 path/range。
- 打开旧 code note：既有 path/range heading 仍按原正文显示，不发生自动迁移或重写。
- 点击 header 最大化：便签占满中央 conversation + note 区域，右侧文件树与 main topbar 保持可用。
- 最大化期间新建/编辑草稿、selected note 不丢失；对话幕布不可见且无法 keyboard focus。
- 点击还原：恢复进入最大化前的分栏比例；切出 notes 再进入时默认回到普通分栏。
- 在 saved code note 点击“采集来源”：便签替换左侧对话幕布，文件 Editor 位于中间，right panel/file tree 保持可用。
- 在该 Editor 中最大化并还原文件：便签现场暂时隐藏但不卸载，draft/selected note 不丢失；关闭最后 tab 或退出 Editor 后返回便签。
- 从文件树、search、message 或 Git 普通打开文件：继续使用既有 chat/projectMap companion，不被本链路改变。
