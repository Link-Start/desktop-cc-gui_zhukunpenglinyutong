## Why

当前 workspace diff 弹窗虽然具备编辑能力，但用户必须先点击“编辑”并离开 diff 视图，审查上下文与修改动作被割裂。需要将其升级为 IDEA-style compare：左侧持续展示上个版本，右侧源代码打开即能编辑，让 `review -> edit -> save -> refresh` 成为连续操作。

## 目标与边界

- Git、Checkpoint、Session Activity 的 live workspace text diff 使用统一双栏交互。
- 左栏展示 unified patch 对应的上个版本并保持只读，右栏读取当前 workspace 文件并直接编辑。
- 保存继续复用现有 workspace file save contract，并刷新 live diff 与 Git status。
- historical diff、deleted file、image/PDF/preview-only file 保持只读。

## 非目标

- 不实现 3-way merge、chunk apply/reject 或左右双向编辑。
- 不改变 commit history、PR compare、rewind review 等历史 diff 的只读语义。
- 不新增文件写入 API 或第三方编辑器依赖。

## What Changes

- 移除 live workspace diff 弹窗的 `diff/edit` mode toggle 与“编辑”按钮，但完整保留原 `GitDiffViewer` 弹窗、Header Toolbar 与 renderer。
- 可编辑文本文件默认渲染固定双栏：左侧“上个版本”、右侧“源代码”。
- 复用现有 CodeMirror compare primitives，保留差异行对齐、同步滚动、差异跳转与 theme contract。
- 右栏复用 `useFileDocumentState` 的 dirty/save/error contract，保存后重新加载 patch 与统计。
- 不可编辑目标继续使用只读 diff viewer，并展示稳定的 read-only 语义。
- 默认 `双栏差异 + 全文查看` 组合承载可编辑 compare；切换到 `单栏差异` 或 `区域查看` 时继续使用原 renderer，使既有模式按钮保持可达且有效。

### 方案对比

- 方案 A：在 `GitDiffViewer` 内新建可编辑 renderer。视觉直接，但会复制文件读取、保存、dirty 与 external sync contract。
- 方案 B：复用 `WorkspaceFileComparePanel` 已有 CodeMirror 双栏 primitives，并为 Git review 增加“左只读、右可写”的专用组合。改动更集中且不新增写入链路。
- 采用方案 B，以最小实现获得 IDEA-style 交互并降低回归面。

### 验收标准

- 可写文本 diff 打开后无需点击“编辑”即可在右栏输入。
- 左栏标题为“上个版本”且无法编辑；右栏标题为“源代码”。
- 两栏 MUST 保持 horizontal side-by-side，不得退化为上下堆叠；窄窗口使用横向滚动。
- 原有“双栏差异 / 单栏差异 / 全文查看 / 区域查看 / 关闭 / 最大化 / 差异导航”能力保持可达。
- `Ctrl/Cmd+S` 与保存按钮可保存右栏，成功后 patch、统计与 Git status 更新。
- 未保存内容关闭或切换文件时不得静默丢失。
- 未保存保护 MUST 使用应用内 `AlertDialog`，不得调用平台原生 `window.confirm`；按钮语义为“保存并关闭 / 继续编辑 / 放弃修改”。
- deleted、binary、image、PDF 与历史 diff 不暴露可执行保存能力。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `editable-workspace-diff-review-surface`: 将显式 `diff/edit` mode 切换升级为左侧只读 baseline、右侧默认可编辑 working source 的固定双栏 contract。

## Impact

- Frontend：`WorkspaceEditableDiffReviewSurface`、file compare/editor primitives、相关 CSS 与 i18n。
- Call sites：Git panel、Checkpoint panel、Workspace Session Activity panel 的 live workspace diff modal。
- Tests：focused component tests、existing Git/Status/Session Activity integration assertions。
- Dependencies：不新增依赖；继续使用现有 React、CodeMirror、Tauri workspace file service。
