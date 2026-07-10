## Why

现有 note card surface 被限制在右侧窄面板，长文编辑、图片预览和便签浏览彼此争抢空间，导致已有的 Markdown、附件、归档能力难以高效使用。需要将便签提升为中央工作区的一等 surface，在不打断当前 conversation 的前提下，让记录、查找和对话引用形成连续工作流。

## What Changes

- 保留右侧工具栏的 note card icon 作为入口，但点击后打开中央 note workbench，而不是在右侧面板正文区渲染便签管理器。
- 中央区域采用左侧 conversation : 右侧 note workbench = 1 : 2 的横向分栏，Composer 跟随 conversation column，当前 workspace/thread 不变。
- 两个 column 之间提供可访问的 vertical resize separator，用户可按当前任务临时调整宽度。
- 将 note surface 重构为适合中央区的“collection navigation + searchable note list + focused editor/preview”工作台，保留 Markdown、图片、归档、恢复、永久删除等现有能力。
- 补齐 collection-scoped 搜索和清晰的 selected/loading/empty/error 状态，窄窗口下使用稳定的 responsive layout。
- 不修改 note card storage、Tauri command、`@#` composer reference 或 conversation context contract。

## 目标与边界

- 目标：便签入口可达、中央分栏稳定、关键 CRUD 能力不回退、对话上下文连续。
- 边界：仅调整 frontend center mode、layout composition、note card presentation 与对应 i18n/tests。

## 非目标

- 不新增 tags、pin、color、reminder、sync 或协作数据模型。
- 不改变本地文件目录、note identity、backend API 与附件生命周期。
- 不把便签扩展成独立全屏管理后台。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace-note-card-pool`: 将 note card surface 从右侧面板正文区迁移到中央 1:2 分栏工作台，并强化搜索、选择、编辑与 responsive behavior。

## 方案对比与取舍

1. **独立 `notes` center mode（采用）**：语义清晰，可直接表达 note/chat 1:2 composition；需要补齐 layout mode 与节点 wiring。
2. **复用 `editor` center mode**：能复用部分 split CSS，但会把 note lifecycle 混入 file tab/editor contract，后续关闭与恢复语义易漂移。
3. **仅扩大右侧面板**：改动最少，但仍占用 activity/tool panel，无法解决长文编辑与对话并行的核心问题。

## 验收标准

- 点击 note card icon 后中央区出现 note workbench，conversation 保持可见；默认左侧 conversation 与右侧 note workbench 宽度约为 1:2。
- 中间 separator 可左右拖动，两侧内容均受最小宽度保护。
- Composer 位于 conversation column，切换便签、collection 或搜索不会切换 thread/workspace。
- active note 支持创建、选择、编辑、保存、归档、删除；archive 支持只读预览、恢复和删除。
- 搜索仅作用于当前 collection，结果可扫描且 loading/empty/error 状态不重叠。
- targeted tests、TypeScript typecheck 与 lint 通过；桌面尺寸下完成视觉核验。

## Impact

- Frontend：`CenterMode`、`useLayoutNodes`、`DesktopLayout`、`AppLayout` wiring、`WorkspaceNoteCardPanel`、note card CSS 与 i18n。
- Tests：layout composition、入口 mode switching、note CRUD/search behavior。
- API / dependency：无新增依赖，无 backend/Tauri contract 变更。
