## 1. Contracts And Storage

- [x] 1.1 [P0, depends: none] 定义 `WorkspaceNoteCardSource`、`NoteCaptureDraft` 与 monotonic capture request types；输入为 design source union，输出为 feature-local TypeScript contracts；验证 `npm run typecheck` 与 pure type consumers 编译通过。
- [x] 1.2 [P0, depends: 1.1] 扩展 frontend Tauri create mapping 与 Rust note JSON document，持久化 optional source；输入为 source contract，输出为 additive create/get storage behavior；验证 mapping test + Rust legacy/create/update/archive/restore tests。

## 2. Pure Capture Builders

- [x] 2.1 [P0, depends: 1.1] 新增 safe fenced-code draft builder，覆盖 edit/preview selection、language 与 line-range metadata；输入为 canonical code selection，输出为 `NoteCaptureDraft`；验证 pure unit tests覆盖 backtick fence、single/multi-line与 invalid range。
- [x] 2.2 [P0, depends: 1.1] 扩展 thread text utility 增加 semantic note policy；输入为 normalized `ConversationItem[]`，输出为 Markdown、included item ids/count；验证 reasoning/tool/control/live assistant exclusion 与 final dialogue/diff/review inclusion tests。
- [x] 2.3 [P1, depends: 1.1] 新增 conversation DOM selection snapshot helper；输入为 `Selection` 与 canvas root，输出为 frozen text/item ids或 null；验证 single row、multi-row、outside/collapsed selection tests。

## 3. Workbench State And Layout

- [x] 3.1 [P0, depends: 1.1, 1.2] 重构 `WorkspaceNoteCardPanel` 为 `idle/viewing/creating/editing/archived-preview`；输入为现有 CRUD 与 optional capture request，输出为 view-first Master-Detail behavior；验证 default-no-form、new/edit/cancel/save/capture/archive focused component tests。
- [x] 3.2 [P1, depends: 3.1] 重排 note workbench CSS 与 source summary，收敛 header/list/detail/actions并保持 narrow responsive；输入为现有 theme tokens，输出为无重叠、keyboard-accessible layout；验证 DOM/class assertions、manual viewport smoke 与 existing layout tests。

## 4. Capture Surface Wiring

- [x] 4.1 [P0, depends: 2.1, 3.1] 在 file edit/preview selection surface 接入 shared note capture context menu；输入为 CodeMirror/preview canonical selection，输出为 prefilled note request；验证 preview/edit tests并确认 annotation tests保持通过。
- [x] 4.2 [P0, depends: 2.2, 2.3, 3.1] 在 conversation canvas 接入 selection/whole-thread context menu；输入为 frozen DOM selection与 canonical items，输出为 selection或semantic-thread draft；验证 Copy、file-link ownership、streaming exclusion与 Messages focused tests。
- [x] 4.3 [P0, depends: 3.1, 4.1, 4.2] 在 layout owner 接入低频 capture request并路由到 notes center；输入为 file/conversation callbacks，输出为 consumed monotonic request；验证 current workspace/thread保持、dirty rejection不重放与 layout hook tests。

## 5. Localization And Regression Closure

- [x] 5.1 [P1, depends: 3.1, 4.1, 4.2] 补齐 note capture/workbench source与state文案；输入为 English/Chinese canonical keys，输出为全部 locale key parity；验证 i18n key scan与相关 component tests。
- [x] 5.2 [P0, depends: 1.2, 2.1, 2.2, 2.3, 3.2, 4.3, 5.1] 执行 focused frontend/Rust regression、lint、typecheck、large-file guard、cross-layer checks 与 strict OpenSpec validation；输入为全部实现，输出为 verification evidence与未提交验收包；验证所有必需命令结果并保留用户手工验收项。

## 6. Source Navigation And Rich Code Follow-up

- [x] 6.1 [P0, depends: 3.1, 4.3] 将 code source summary 接入 existing editor navigation；输入为 persisted `codeSelection` source，输出为 clickable source action、file open、centered start line 与 restored line range；验证 component keyboard/click callback test + layout routing test。
- [x] 6.2 [P0, depends: 2.1, 3.1] note detail 启用 existing Markdown message code renderer，并将新 code capture body 收敛为 fence-only；输入为 persisted Markdown/source，输出为 highlighted/copyable code preview且不重复 path/range；验证 Markdown prop contract + pure builder regression，旧 note 不迁移。
- [x] 6.3 [P0, depends: 6.1, 6.2] 补齐 i18n、note-scoped styling 与 focused regression，执行 lint、typecheck、large-file/runtime contract 与 strict OpenSpec verification；输出为未提交验收包。

## 7. Workbench Layout Maximize Follow-up

- [x] 7.1 [P0, depends: 3.2] 在 Desktop layout owner 增加 transient note maximize state 与 feature-local context；输入为 header toggle，输出为 full central note layer、hidden/inert conversation companion、preserved right panel 与 split ratio。
- [x] 7.2 [P0, depends: 7.1] 在 `WorkspaceNoteCardPanel` header 增加 keyboard-accessible maximize/restore action，并补 component/layout focused tests覆盖 toggle、draft preservation、`aria-hidden`/`inert`、right panel persistence 与 leave-notes reset。
- [x] 7.3 [P0, depends: 7.1, 7.2] 同步 Trellis executable contract，执行 focused regression、lint、typecheck、build、large-file/runtime contract 与 strict OpenSpec verification；输出为未提交验收包。

## 8. Source Navigation Companion Follow-up

- [x] 8.1 [P0, depends: 6.1, 7.1] 扩展 existing `EditorSplitCompanion` 支持 `notes`，仅由 saved code source navigation 传入；输入为 source path/range，输出为 notes-left/editor-center/right-panel layout，普通 file-open behavior 不变。
- [x] 8.2 [P0, depends: 8.1] 保持 `WorkspaceNoteCardPanel` 在 notes center 与 Editor companion 间 mounted，关闭最后 tab/退出 Editor 返回 notes，并在 companion mode 隐藏 maximize action；验证 selected note/draft/state preservation 与 interaction ownership。
- [x] 8.3 [P0, depends: 8.1, 8.2] 补齐 focused controller/layout/component regression，同步 Trellis executable contract，执行 lint、typecheck、build、runtime/large-file gate 与 strict OpenSpec verification；输出为未提交验收包。

## 9. Pre-Commit Review Closure

- [x] 9.1 [P0, depends: 2.1] code capture 仅用 trim 判空，fenced body 保留 canonical selection 的 leading indentation 与 trailing newline；验证 whitespace-only rejection、缩进、多行末尾换行与 embedded backtick regression。
- [x] 9.2 [P0, depends: 6.1, 8.1] 扩展 additive `EditorNavigationLocation.endLine`，在目标文件加载完成后由 CodeMirror 同一 transaction 恢复 line range；移除 source action 的 premature range publish，验证普通 cursor navigation、range navigation、document-shortening clamp 与 notes companion routing。
- [x] 9.3 [P0, depends: 9.1, 9.2] 修复本 change 自有 Rust formatting，更新 Trellis executable contract 与 verification evidence，并执行 focused Vitest、lint、typecheck、build、Rust、runtime/large-file、strict OpenSpec gate 后整体提交。

## 10. Conversation Bottom Action Trigger Follow-up

- [x] 10.1 [P0, depends: 4.2] 在最新 final assistant boundary 的现有 action group 最左侧增加 9px、`strokeWidth={1.75}` 的 note capture icon，将 History 视觉尺寸单独调整为 13px，并保持 Copy/Fork 既有视觉尺寸与样式；输入为现有 `useConversationNoteCaptureMenu` action，输出为与右键菜单相同的低频 trigger；按钮热区、旧 final boundary 与右键 ownership 保持不变。
- [x] 10.2 [P0, depends: 10.1] 增加 focused regression，覆盖最新 action group 的 Note/Copy/Fork/Rewind 顺序与尺寸 contract、shared menu、semantic thread capture 原 draft，以及旧 final boundary 不新增按钮；执行 focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation。
