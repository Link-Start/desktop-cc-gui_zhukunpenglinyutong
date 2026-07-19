# 统一来源感知便签捕获与工作台重排

## Goal

将代码选区、对话局部文本和整段语义对话统一捕获到现有 workspace note cards，并把便签工作台重构为 view-first Master-Detail 交互，形成 capture、确认、保存、回看闭环。

关联 OpenSpec change：`unify-source-aware-note-capture-workbench`

## Requirements

- 代码 edit/preview selection 右键生成 fenced-code note draft，保留 path、line range 与 language。
- 对话局部 selection 右键生成 selection note draft，保留 thread/message attribution。
- 整段对话使用 semantic transcript，只保存 durable user/assistant dialogue 与 final results。
- 所有 capture 打开现有 notes workbench creating state，不直接保存。
- workbench 默认无表单；已有 note 先只读，显式编辑；archive 永远只读。
- optional source metadata 跨 TS/Tauri/Rust 持久化，旧 note JSON 无迁移兼容。
- 已保存 code source summary 可打开对应 workspace file，居中 start line 并恢复 captured range。
- source summary 打开文件后，便签留在左侧替换 conversation，Editor 位于中间；关闭 source file 返回便签，普通 file-open 行为不变。
- code detail 复用既有 Markdown message renderer；新 capture body 仅保存 fenced code，不重复 path/range。
- workbench header 支持 layout-level maximize/restore；最大化只覆盖 conversation companion，保留 right panel/main topbar 与原 split ratio。
- 保持 annotation、Markdown file-link menu、streaming、attachments、query、archive、Composer reference 与 dirty guard。

## Acceptance Criteria

- [x] 三类 capture 入口均生成正确 prefilled draft。
- [x] semantic transcript 排除 reasoning/tool/control/live transient。
- [x] 默认 workbench 不出现创建 inputs。
- [x] view/new/edit/cancel/save/archive/capture 状态转换正确。
- [x] dirty draft 不被 capture/navigation 静默覆盖。
- [x] code source 可打开文件并恢复行范围；creating/editing source 不可跳转。
- [x] code detail 复用 shared Markdown renderer，新 capture body 不重复 source metadata。
- [x] workbench maximize 后 conversation 保持 mounted 但 hidden/`aria-hidden`/`inert`，right panel 保持可用；restore 与 leave-notes reset 正确。
- [x] source-origin Editor 使用 notes companion，便签 state 保持 mounted；关闭最后 tab/退出 Editor 返回 notes，workspace switch 不泄漏旧 companion。
- [x] 文件树、搜索、message file link、Git 与 Project Map 等普通入口继续使用 chat/project-map companion。
- [x] 旧 note JSON 与现有 CRUD/reference/attachment lifecycle通过回归。
- [x] focused Vitest、lint、typecheck、相关 Rust tests、large-file/cross-layer/OpenSpec gates通过。
- [x] 不执行 Git commit，保留给用户最终验收。

## Definition of Done

- OpenSpec tasks 代码项完成并有验证结果。
- Frontend/backend contract、i18n 与 tests同步。
- 无新增 dependency，无无关重构。
- 交付手工验收路径、影响面、回滚边界与残余风险。

## Technical Approach

- Feature-local `NoteCaptureDraft` / `WorkspaceNoteCardSource`。
- layout owner 维护低频 monotonic capture request。
- FileView/Messages 只做 source adapter与local context menu。
- `WorkspaceNoteCardPanel` 使用 explicit interaction state。
- `DesktopLayout` 通过 feature-local context 管理 transient maximize state，不持久化、不查询 sibling DOM。
- `EditorSplitCompanion` 增加 additive `"notes"` variant，仅由 saved code source action 显式请求；Desktop 复用现有 horizontal Editor split 与 divider。
- note node 在 notes center/Editor notes companion 间保持 mounted；`canMaximize` 只在 notes center 开启。
- Rust note document新增 optional `source`，create trust boundary显式验证。

## Out of Scope

- folder/tag/drag sort/autosave。
- 独立代码笔记 storage或第二套 CRUD。
- raw provider transcript、reasoning/tool logs。
- conversation source backlink navigation。
- Git commit/session record。
