## Why

便签已经迁移到中央 `1:2` 工作区，但内部仍采用“全宽列表在上、编辑器在下”的管理面板结构，横向空间利用率低，编辑中切换便签还可能覆盖未保存草稿。需要在不改变 storage/API contract 的前提下，将它优化为适合桌面端连续记录、编辑和对话引用的工作台。

## What Changes

- 将右侧 note workbench 改为 responsive Master-Detail：宽布局左侧是可扫描列表，右侧是当前便签 editor/preview；窄布局回退为上下结构。
- 增加 draft dirty state、明确的 `未保存 / 保存中 / 已保存 / 保存失败` feedback，并在切换便签、collection 或新建前保护未保存内容。
- 保留显式保存 contract 与现有 Tauri 写入路径；本轮不启用每次输入触发的后台 autosave，避免改变磁盘写入语义和 backend pressure。
- 精简列表行操作：高频 archive/restore 保持可达，永久删除进入 overflow menu；archive 后提供可撤销反馈。
- 在 active editor 中提供显式“引用到对话”入口，复用现有 composer note reference contract，不复制正文、不改变 conversation context payload。
- 完善 conversation/note separator：持久化用户比例、双击恢复默认 `1:2`、keyboard resize 与 accessible value feedback。
- 补齐 focus-visible、tab keyboard navigation、async status announcement、长文本/窄窗口适配和列表 rendering guard。

## 目标与边界

- 目标：降低便签浏览与编辑切换成本，消除未保存草稿被静默覆盖的风险，让便签可直接进入当前对话工作流。
- 边界：只修改 frontend note workbench、layout preference、现有 composer reference wiring、i18n 和 focused tests。
- 兼容性：沿用当前 note identity、workspace scope、Markdown、attachment、archive 与 storage directory contract。

## 非目标

- 不新增 tag、pin、color、reminder、folder、sync 或 collaboration 数据模型。
- 不修改 Rust command、`noteCardsFacade` public signature、文件格式或附件生命周期。
- 不引入第三方 state/editor/virtualization dependency。
- 不把便签改造成自由画布或独立全屏知识库。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace-note-card-pool`: 强化中央便签工作台的 Master-Detail、草稿保护、对话引用、可撤销归档与 accessible interaction contract。

## 方案对比与取舍

1. **Responsive Master-Detail + 显式保存与 dirty guard（采用）**：充分利用现有 2/3 宽度，同时保持后端写入语义稳定；实现范围可控。
2. **每次输入 debounce autosave**：更接近通用 Notes 产品，但会改变创建时机、失败恢复和磁盘写入频率，需要 backend write coalescing contract 支撑，本轮不采用。
3. **仅做 CSS 视觉微调**：改动最小，但无法解决编辑防丢、列表/编辑器争抢垂直空间和对话引用不可发现的问题。

## 验收标准

- 宽布局下 note list 与 editor/preview 左右并列；窄布局无重叠并自动回退上下结构。
- 修改 active note 后切换 note、collection 或新建时，不得静默丢弃草稿；用户可以保存后继续或保留当前编辑。
- 保存状态具备可访问 announcement，失败后草稿仍保留且可重试。
- archive 操作可在短时间内撤销；permanent delete 仍需 confirmation。
- 当前 active note 可通过显式 action 引用到当前 Composer，且不切换 thread/workspace。
- separator 支持 pointer、keyboard、双击复位，并恢复最近一次合法比例。
- focused Vitest、typecheck、lint、OpenSpec strict validation 通过。

## Impact

- Frontend：`WorkspaceNoteCardPanel`、note card CSS、`DesktopLayout` split preference、Composer reference wiring 与 i18n。
- Tests：note draft lifecycle、Master-Detail、archive undo、reference action、separator persistence/keyboard contract。
- API / storage / dependency：无 breaking change，无新增依赖，无 backend migration。
