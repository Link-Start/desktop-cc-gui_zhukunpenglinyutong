## Why

当前文件树已经支持多选，但多文件之间的内容差异只能借助外部 IDE 或 Git diff surface 间接查看，无法在 ccgui 中直接完成“选文件 -> 对比 -> 修改 -> 保存”的闭环。

新增 workspace file compare tool 可以把多配置文件、环境文件、脚本变体等常见对比场景留在中间工作区内完成，并补齐右上角工具入口的临时文本对比能力。

## 目标与边界

- 文件树入口：当用户在 Files 面板选中 2 个及以上文件并右键时，菜单提供“文件对比”动作。
- 中间区域：点击“文件对比”后进入新的 compare center surface，展示选中文件的并排对比。
- 可编辑性：从 workspace 文件进入的对比列必须可编辑并可保存，复用现有 workspace file write contract、dirty state 与 save shortcut 语义。
- 工具入口：右上角功能区菜单新增“文件对比”动作，打开一个左右两栏 scratch compare surface，用户可以手动粘贴文本进行对比。
- 默认假设：文件树多选入口支持 2-4 个文件的 N-way 多列对比；超过 4 个时不自动截断、不静默丢文件，必须提示用户缩小选择。

## 非目标

- 不做 Git history / PR / commit compare 的替代品；历史 diff 仍归 Git surface 管理。
- 不实现复杂 merge conflict resolver、三方合并或自动写回多文件策略。
- 不在本轮引入跨进程 diff backend；文本 diff 计算优先在 frontend feature-local utils 内完成。
- 不支持二进制、图片、PDF、Office 文档等非文本内容的可编辑对比。
- 不改变现有文件双击打开、多 tab、右侧 Files 面板刷新/拖拽语义。

## What Changes

- 新增 `workspace-file-compare-tool` capability，定义文件树多选对比和 scratch 文本对比的行为契约。
- 扩展 `FileTreePanel` 右键菜单：当选中集合中至少有两个文件时显示“文件对比”。
- 扩展 layout/controller state：新增 compare center mode 或等价 center surface state，使中间区域可以在 chat/editor/diff 之外展示 file compare tool。
- 新增 file compare surface：
  - workspace mode：按选中文件创建 compare columns，读取文件内容，计算差异，高亮 changed lines。
  - scratch mode：左右两侧为空文本编辑区，可粘贴文本并实时对比。
- workspace mode 中每个可写文本列提供编辑、dirty indicator、保存、错误提示和只读原因。
- 右上角功能区菜单新增“文件对比”入口，走 scratch compare mode。
- 增加 i18n 文案、focused Vitest 覆盖和 OpenSpec 验收契约。

## 技术方案选项

### Option A: 使用 CodeMirror merge extension

引入 `@codemirror/merge`，直接使用成熟 merge/diff view 能力。优点是交互成熟、维护成本低；缺点是新增依赖，需要验证与现有 `@uiw/react-codemirror`、lazy boundary、主题和保存链路的兼容性，且多于 2 列的 N-way 展示仍需额外编排。

### Option B: 复用现有 FileCodeMirrorEditor，feature-local 行级 diff 高亮

新增 `WorkspaceFileComparePanel`，每列复用现有 CodeMirror 编辑器/文件读写 contract，diff 计算放在 `src/features/files/utils`。优点是最贴合现有保存、dirty、language extension、shortcut 语义，blast radius 小；缺点是初版 diff 体验会偏“行级高亮 + 同步滚动”，不做完整 merge gutter。

### 取舍

推荐 Option B 作为第一阶段。当前需求的核心是“在 ccgui 内快速多文件对比且可编辑”，不是 IDE 级 merge resolver。先复用现有编辑器与保存链路能降低未知风险；如果后续需要更强的 merge gutter，再把 `@codemirror/merge` 作为第二阶段引入。

## Capabilities

### New Capabilities

- `workspace-file-compare-tool`: 定义 workspace 文件多选对比、scratch 文本对比、可编辑保存、只读限制、差异展示和入口行为。

### Modified Capabilities

- `filetree-multitab-open`: 扩展文件树多选后的上下文菜单能力，保证新增 compare action 不破坏现有多选、拖拽、双击打开、多 tab 语义。
- `desktop-editor-split-layout`: 扩展桌面中间区域的编辑/对比 surface 关系，保证 compare surface 与现有 editor maximized / composer placement 不互相遮挡。

## Impact

- Frontend components:
  - `src/features/files/components/FileTreePanel.tsx`
  - 新增 `src/features/files/components/WorkspaceFileComparePanel.tsx` 或同级子组件
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/layout/components/DesktopLayout.tsx`
  - `src/features/app/hooks/useGitPanelController.ts` 或更合适的 center-mode controller
  - `src/features/app/components/MainHeaderActions.tsx`
- Frontend hooks/utils:
  - 复用 `useFileDocumentState` / `readWorkspaceFile` / `writeWorkspaceFile`
  - 新增 feature-local diff helper，例如 `src/features/files/utils/fileCompareDiff.ts`
- Styles:
  - 新增或扩展 file compare feature style，避免污染 `diff-viewer.css` 和现有 file tree styles。
- i18n:
  - 新增 `files.compareFiles`、`files.fileCompare`、`files.compareSelectedFiles`、`files.compareText` 等文案 key。
- Dependencies:
  - 第一阶段不新增依赖；若实现阶段证据显示现有行级 diff 不够，再单独提议引入 `@codemirror/merge`。

## 验收标准

- 文件树选中两个文本文件，右键菜单显示“文件对比”，点击后中间区域展示两列对比。
- 文件树选中三个文本文件，点击“文件对比”后中间区域展示三列对比，差异行有稳定高亮。
- 在 workspace file compare 中修改任一文件并保存，保存走现有 workspace file write pipeline；保存失败显示可读错误。
- 选中少于两个文件、选中包含文件夹或非文本文件时，compare action 不出现或进入有明确只读/不支持原因的受限状态。
- 选中文件超过 4 个时，compare action 不得直接打开，也不得只取前 4 个文件；用户必须看到缩小选择的提示。
- 右上角功能区菜单点击“文件对比”后，中间区域展示左右两侧可输入文本区域，输入后实时显示差异。
- 进入/退出 compare surface 不清空现有打开文件 tabs，不破坏 editor maximize 和 composer placement。
- focused tests 覆盖文件树菜单条件、controller state、scratch compare 打开、workspace compare save、diff helper 基本行为。
