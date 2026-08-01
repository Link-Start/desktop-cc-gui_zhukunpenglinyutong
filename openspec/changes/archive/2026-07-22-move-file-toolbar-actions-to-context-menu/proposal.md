## Why

文件编辑区当前用独立工具栏长期占用纵向空间，而编辑相关命令与浏览器原生右键菜单分散，导致文件操作入口不统一。现有 file tab 已采用 `RendererContextMenu`，本次应复用同一菜单契约，把文件级命令收敛到内容区右键入口，并让返回动作与 Tab 处于同一行。

## 目标与边界

- 文件内容区右键菜单提供剪切、复制、粘贴以及原工具栏中的文件级命令。
- 菜单复用 file tab context menu 的视觉、viewport clamp、keyboard 与 dismiss 行为。
- 返回按钮移动到 Tab 行最左侧；删除 Tab 下方的路径/工具栏行。
- 保持现有 editor、Git Blame、Intent Canvas、code navigation、preview/edit 与 save handler 语义。
- Preview/read-only/无选区等状态通过 disabled contract 表达，不伪造不可执行能力。

## 非目标

- 不修改 backend command、文件持久化模型、Tab lifecycle 或 Git 数据获取协议。
- 不替换 CodeMirror，也不新增 context-menu 或 clipboard dependency。
- 不改变 file tab context menu 已有 close/detach/Git 行为。
- 不为浏览器受限的 clipboard permission 增加静默降级或非安全写入方式。

## What Changes

- 文件内容区增加 portal-based context menu，包含 Cut、Copy、Paste 与现有 toolbar commands。
- Clipboard command 根据 CodeMirror selection、preview DOM selection 与 editable state 决定可用性；失败显式提示。
- Git Blame、关联 Canvas、跳转定义、查找引用、编辑/预览、保存迁移到右键菜单。
- 返回按钮与 file tabs 合并为单行 header，原路径/动作 toolbar 不再渲染。
- main window 与 detached file explorer 复用同一 `FileViewPanel` 行为。

## 技术方案取舍

### 方案 A：复用 `RendererContextMenu`（采用）

复用现有 icon slot、portal、submenu、viewport clamp、Escape/outside-click 与 theme token；`FileViewPanel` 只负责构造 file-specific items 并调用现有 handler。改动集中、行为与 Tab 菜单一致。

### 方案 B：保留浏览器原生菜单并追加应用命令（不采用）

WebView/browser 原生 context menu 无可靠跨平台 API 注入 React action，无法稳定加入 Git Blame、Canvas 与 navigation 命令。

### 方案 C：复制一套文件菜单组件（不采用）

实现直接，但会重复定位、焦点、theme 与 accessibility contract，后续与 Tab 菜单产生视觉和行为漂移。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `filetree-multitab-open`: 扩展文件视图 header 与内容区 context menu contract，同时保持现有 Tab 菜单和多 Tab lifecycle。

## 验收标准

- 右键文件编辑/预览内容时出现与 Tab 右键相同视觉规格的菜单。
- 菜单包含 Cut、Copy、Paste；编辑态按 CodeMirror selection 执行，Preview/read-only 下 Cut/Paste disabled。
- 原工具栏的 Git Blame、Canvas、definition、references、preview/edit、save 命令可从菜单触达，原 handler 与 disabled/loading 语义保留。
- 返回按钮位于 Tab 行最左侧，Tab 下方不再渲染旧路径/动作 toolbar。
- file tab context menu、detached explorer、dirty state、preview/edit 切换不回归。
- focused Vitest、CSS visual contract、typecheck 与 OpenSpec strict validation 通过。

## Impact

- Frontend：`FileViewPanel`、文件编辑器/预览交互测试、file-view CSS visual contract。
- i18n：补充 file content context menu 与 clipboard command/error 文案。
- OpenSpec：更新 `filetree-multitab-open` behavior contract。
- API/依赖：无新增 backend API、无新增 npm dependency、无持久化迁移。
