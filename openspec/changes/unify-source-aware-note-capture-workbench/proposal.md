## Why

当前 `workspace note card` 已具备 project-scoped CRUD、Markdown、图片、搜索、归档与 Composer 引用，但创建入口仍局限在便签工作台，且工作台默认长期展示创建表单，浏览与创作状态混杂。代码选区、对话局部文本与整段语义对话也缺少统一的便签捕获入口，用户必须手工复制并丢失来源上下文。

本变更把上述入口收敛为 source-aware note capture，并将便签工作台重排为明确的浏览、创建、编辑和归档状态；目标是在不复制存储系统、不破坏现有 conversation/code annotation 能力的前提下，形成从上下文捕获到便签沉淀的完整闭环。

## 目标与边界

- 统一支持三类 capture source：
  - workspace file/code selection；
  - conversation 局部文本 selection；
  - 当前 thread 的 semantic transcript。
- 所有入口生成统一 `NoteCaptureDraft`，打开现有 note workbench 的创建态并预填 title、Markdown body 与 structured source metadata。
- semantic transcript 只包含 canonical user/assistant dialogue、最终 diff/review/result；排除 reasoning、tool logs、approval/control rows 与 transient streaming state。
- note workbench 使用 `idle / viewing / creating / editing / archived-preview` 状态；默认浏览态不渲染 title/body/attachment/save inputs。
- 保持现有 workspace-scoped storage、active/archive、search、attachments、Composer reference 与 dirty-draft guard。
- 新 source metadata 使用 additive optional contract，旧 note JSON 无需迁移即可继续读取。
- code selection source summary 可点击打开对应 workspace file，并定位、恢复采集行范围。
- 从已保存 code note 的 source summary 打开文件时，note workbench 作为 Editor companion 留在左侧替换 conversation；普通文件打开入口维持既有 conversation companion。
- note detail 复用现有 Markdown message code renderer 展示 fenced code；新 capture body 不再重复 path/line metadata。

## 非目标

- 不新增独立“代码笔记”存储、第二套 note CRUD 或平行 backend command。
- 不在本轮引入 folder tree、tags、drag sorting、autosave 或跨 workspace note move。
- 不保存 raw provider transcript、reasoning、tool execution log 或 approval payload。
- 不替换现有 code annotation / AI context selection 能力。
- 实现阶段不自动提交 Git commit；仅在用户完成验收并明确授权后整体提交。

## What Changes

- 新增 shared `NoteCaptureDraft` 与 source metadata contract，覆盖 code、conversation selection 和 conversation thread。
- 在代码选择 surface 与对话幕布接入 shared renderer context menu 的“保存到便签…”入口。
- 增加 semantic transcript serializer policy，并复用 canonical `ConversationItem`，避免从 DOM 或 raw provider payload重建整段对话。
- 扩展 note card frontend mapping、Tauri command payload 与 Rust JSON document，使 source metadata 可选持久化、更新和回读。
- 重构 `WorkspaceNoteCardPanel` 的交互状态与 Master-Detail layout：默认只读、显式新建/编辑、capture prefill、archive preview。
- 增加 source summary 与 code-source navigation；复用现有 editor navigation 打开 workspace-relative file，并恢复采集行范围，不为 conversation source 伪造不可用 backlink。
- 将 source-origin navigation 接入现有 Editor companion contract：notes 留在左侧且保持 mounted，文件在中间，关闭最后一个 source file 后回到 notes；不改变文件树、搜索、消息链接与 Git 等普通 file-open 行为。
- code note detail 复用现有 Markdown message code renderer；新采集的 fenced body 仅保存代码正文，path、line range 与 language 由 structured source 独立呈现。
- 便签工作台 header 增加 layout-level maximize/restore action；最大化时覆盖 conversation companion，但保留 main topbar 与 right panel，并在还原后恢复原 split ratio。
- 补充 i18n、focused Vitest、Tauri mapping tests、Rust backward-compatibility/storage tests 与 OpenSpec verification evidence。

## Capabilities

### New Capabilities

- `workspace-note-context-capture`: 定义代码选区、对话局部选区、整段 semantic transcript 到统一 note draft 的入口、过滤、来源与交互 contract。

### Modified Capabilities

- `workspace-note-card-pool`: 将默认 quick-create surface 改为 explicit state-driven Master-Detail workbench，并定义 capture draft、view-first editing 与 archive preview 行为。
- `workspace-note-card-storage`: 增加 optional structured source metadata 的持久化、兼容读取与更新 contract。

## 方案比较与取舍

### Option A：统一 draft + 复用现有 workbench/storage（采用）

- capture adapters 只生成 `NoteCaptureDraft`，创建、保存、附件与错误恢复继续走现有 note card path。
- 优点：single source of truth、旧数据兼容、回滚边界清晰、不会让 conversation/code surface 持有 storage 逻辑。
- 代价：需要低频跨层传递 capture request，并扩展 optional source mapping。

### Option B：各 surface 直接调用 `noteCardCreate`

- code/conversation context menu 直接保存并显示 Toast。
- 优点：表面实现较短。
- 缺点：绕过用户确认、title/body 编辑、dirty draft 与 workbench 状态；三处容易复制 payload mapping，后续行为漂移，因此不采用。

### Option C：新增独立代码笔记模块

- 按参考产品建立 folder tree、独立 editor 与存储。
- 优点：视觉与领域隔离明显。
- 缺点：与现有便签能力重复，增加 migration/search/reference 双轨和用户认知负担，违反 YAGNI，因此不采用。

## 验收标准

- 在 code selection 上执行“保存到便签…”后，notes workbench 进入 creating，正文包含 fenced code，source 显示 path 与 line range；现有 annotation 行为仍可用。
- 点击 code source summary 后打开对应文件，视图定位到 `startLine` 并恢复 `startLine..endLine` 选择；conversation source 保持只读 summary。
- source-origin Editor 打开期间，note workbench MUST 留在左侧替换 conversation，并保持 selected note、搜索与 draft state；普通 file-open MUST 继续使用原 conversation/project-map companion。
- captured code 在只读 detail 中使用现有 Markdown code block renderer 展示 language、syntax highlighting、line numbers 与 copy action；旧 note body 不迁移、不重写。
- 在 conversation 内选中文本右键时，只捕获该 selection；无有效 selection 时可保存当前 thread semantic transcript。
- semantic transcript 不包含 reasoning、tool logs、approval/control rows，也不读取 transient live channel 作为 durable source。
- 正常打开 notes workbench 时不默认展示创建表单；选择已有 note 先进入只读 viewing，点击编辑才出现 inputs。
- 新建、capture、编辑、取消、保存、切换便签、切换 active/archive 均遵守 dirty-draft guard，不静默覆盖输入。
- archived note 始终只读，可恢复或删除；不出现新建/编辑 form。
- 点击便签工作台最大化后，note layer MUST 占满中央 `content` 区域、conversation companion 与 split divider MUST 不可见且不可聚焦，right panel MUST 保持可用；还原后 MUST 恢复原分栏比例与对话状态。
- 最大化期间 creating/editing draft、selected note 与已挂载 conversation state MUST 不丢失；离开 notes center 后最大化状态 MUST 自动清理。
- 旧版不含 `source` 的 note JSON 可 list/get/update/archive/restore；新 note source 可 save/reopen/search 而不丢失。
- 现有 note Composer reference、图片附件、查询、归档/恢复、永久删除与 workspace isolation tests 保持通过。
- focused frontend tests、TypeScript typecheck、相关 Rust tests 与 strict OpenSpec validation 通过。

## Impact

- Frontend：`src/features/note-cards/**`、`src/features/messages/**`、`src/features/files/**`、Editor companion state、layout/app-shell request wiring、Desktop split/maximize state、shared renderer context menu、i18n 与 styles。
- Bridge：`src/services/tauri/noteCards.ts` 及相关 aggregate exports/tests。
- Backend：`src-tauri/src/note_cards.rs` 的 additive JSON document/payload fields；command names 与现有 storage layout 不变。
- Specs：新增 `workspace-note-context-capture`，修改 `workspace-note-card-pool` 与 `workspace-note-card-storage`。
- Dependencies：不新增第三方 dependency。
