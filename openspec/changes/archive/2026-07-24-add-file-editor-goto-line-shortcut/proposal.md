## Why

当前文件编辑器缺少直接按行列定位的入口，用户面对长文件时只能滚动或搜索文本，定位成本高。需要补齐符合桌面 IDE 心智模型的 `Cmd+G` / `Ctrl+G` 行跳转能力。

## 目标与边界

- 在已打开的 CodeMirror 文件编辑器中提供 editor-scoped `Mod+G` 快捷键。
- 使用居中 modal 输入 `行号` 或 `行号:列号`，按 1-based 行列语义定位。
- 支持确认、取消、键盘提交与关闭，并保持现有保存、搜索、定义跳转、引用查询快捷键不变。

## 非目标

- 不新增可配置 shortcut setting，不改变全局快捷键持久化 contract。
- 不为图片、PDF、Markdown preview 或 tabular preview 增加行跳转。
- 不改变跨文件 LSP definition/reference navigation。

## What Changes

- 在 CodeMirror editor keymap 中注册 `Mod+G`，打开居中行列跳转 modal。
- 默认回填当前光标的 1-based `line:column`；确认后校验输入并居中目标行。
- 增加 localized copy、紧凑且 theme-aware 的 modal styles、语义 icon、accessibility attributes 与 focused regression tests。
- 隐藏文件 tab strip 的视觉 horizontal scrollbar，同时保留横向滚动行为。
- 文件 tab 复用文件树的 `getFileTreeIconSvg` resolver，保证同名文件 icon 一一对应。

## 技术方案对比

1. **推荐：React modal + 复用现有 `focusEditorViewAtLocation`**。可精确匹配图示交互、显式采用 1-based column、完整接入 i18n/accessibility，且不新增依赖。
2. **备选：CodeMirror `gotoLine` command**。代码更少，但默认呈现为 editor panel，视觉不符合目标；其 column offset 语义也不等同目标交互。

选择方案 1，以少量 feature-local UI 换取明确且可测试的产品 contract。

## Capabilities

### New Capabilities

- `file-editor-line-navigation`: 定义打开文件编辑器中的快捷键唤起、行列输入、定位、边界与取消行为。
- `file-editor-tab-strip`: 定义 tab 横向滚动兼容性与文件 icon 一致性。

### Modified Capabilities

无。

## 验收标准

- macOS `Cmd+G`、Windows/Linux `Ctrl+G` 在文件编辑器内打开居中 modal。
- 输入 `2744` 定位到第 2744 行第 1 列；输入 `2744:56` 定位到第 2744 行第 56 列。
- `Enter/确定` 完成跳转并将目标行滚动至视口中央；`Esc/取消` 关闭且不移动光标。
- 非法输入不执行跳转；超出文件范围的行列安全收敛，不抛异常。
- 原有 editor shortcuts 与文件编辑行为通过 focused tests。
- modal 使用紧凑布局和行列语义 icon，不牺牲 keyboard/accessibility contract。
- tab strip 不显示 horizontal scrollbar，但触控板、滚轮及程序化横向滚动保持可用。
- 同一文件在 tab 与文件树展示完全相同的 SVG icon resolver 输出。

## Impact

- Frontend: `src/features/files/components/FileCodeMirrorEditorImpl.tsx`、`FileViewPanel.tsx` 及 focused tests。
- UI: `src/styles/file-view-panel.css`、`file-view-panel-shell.css` 与 `src/i18n/locales/*/files.ts`。
- Dependencies/API/backend: 无新增依赖，无跨层 API 或 persistence 变更。
