## Why

mossx 已经具备设置、终端、Git、会话、文件与界面缩放等能力，但入口分散，用户需要记忆菜单位置或快捷键；现有 global search 又要求非空且近似连续命中，无法承担统一入口。与此同时，CodeMirror 已提供语法树父级选择能力，但缺少用户熟悉的 `Ctrl+W` / platform-aware shortcut 暴露。

## 目标与边界

- 将现有 global search 扩展为“内容 + app action”统一入口，不创建第二套 palette。
- 支持 subsequence fuzzy matching、空查询 recent discovery 和稳定的跨类型优先级。
- 复用现有 action handler、recent session/file 数据和 shortcut infrastructure，不复制业务副作用。
- 为 editor-scoped “扩大选择”增加可配置、跨平台安全的快捷键和发现入口。

## 非目标

- 本变更不引入新的搜索窗口、搜索后端或第三方 fuzzy-search dependency。
- 不改变 message 全文索引、API endpoint hydration 或 workspace search scope 语义。
- 不在本变更实现 LSP、Quick Fix、Refactor、Go to Implementation 或 Rust semantic navigation。

## What Changes

- Global search 新增可执行 app action results，例如设置、终端、Git、新建会话、最近活动与界面缩放。
- 搜索匹配从连续 substring 扩展为稳定的 subsequence fuzzy ranking，并保持精确、前缀与紧凑匹配优先。
- 空查询显示最近文件、最近会话和最近执行操作；recent actions 使用有界 local persistence。
- 明确跨类型排序：action、file/session 等 navigation results 优先于 message/history content results，同组保持相关度与 recent order。
- 为 CodeMirror `selectParentSyntax` 增加 configurable editor-scoped shortcut，默认按平台映射为 `Ctrl+W`，并在 Settings -> Basic -> Shortcuts 可见。
- 增加 focused tests，覆盖匹配、排序、action activation、empty state、editable scope 与 editor selection shortcut。

## 方案取舍

### 方案 A：扩展现有 SearchPalette（采用）

复用现有 provider、keyboard navigation、IME handling 和 action callback，只增加 action registry、ranking 与 recent projection。改动集中，用户只有一个入口，也不会增加 AppShell 高频 state。

### 方案 B：新增 Find Action 独立窗口（不采用）

实现隔离，但会复制 palette、快捷键和 action metadata，并让用户继续判断“搜索内容还是搜索操作”，违背统一入口目标。

### 方案 C：仅增加更多快捷键（不采用）

实现最小，但仍要求用户记忆快捷键，不能解决功能入口分散的根因。

## Capabilities

### New Capabilities

- `global-search-action-discovery`: app action registry、action activation、fuzzy matching、empty-query recent discovery 与 recent action persistence。

### Modified Capabilities

- `global-search-result-presentation`: 增加 action/recent sections、跨类型优先级与空查询展示行为。
- `app-shortcuts`: 增加 editor-scoped expand-selection action 的 metadata、platform-aware matching 与 Settings 配置要求。

## 验收标准

- 输入“设置”“终端”“Git”“新建会话”“最近文件”“放大界面”可找到并执行已有行为。
- 输入 `fvp` 可匹配 `FileViewPanel`，精确和前缀匹配仍优先于宽松 subsequence。
- 空查询展示有界的最近文件、最近会话和最近操作，不触发 message 全文搜索。
- action、file 和 session/navigation result 稳定排在 message/history 之前，键盘索引不受 section heading 干扰。
- 搜索输入与 recent 写入不产生 AppShell per-keystroke state 或同步持久化。
- `Ctrl+W` 在文件编辑器内扩大语法选择，在普通 input/textarea 中不被 global handler 劫持，并可在快捷键设置中查看和修改。
- 新行为通过 touched modules 的 focused tests；本变更不要求运行全量测试。

## Impact

- Frontend search types/providers/ranking、SearchPalette presentation、AppShell existing action wiring。
- Shortcut metadata/settings persistence 和 FileCodeMirrorEditor keymap。
- 浏览器 local persistence 仅保存有界 action ids/timestamps，不保存查询文本、消息或文件内容。
- 不引入新的 runtime package，不改变 Tauri IPC command；将现有 CodeMirror transitive package `@codemirror/commands` 声明为 direct dependency，并在 Rust typed settings persistence 中同步增加 nullable field 与定向 round-trip 验证。
