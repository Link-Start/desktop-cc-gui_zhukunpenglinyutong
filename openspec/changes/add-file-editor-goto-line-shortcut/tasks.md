## 1. Editor Interaction

- [x] 1.1 [P0, depends: none] 在 `FileCodeMirrorEditorImpl` 增加 `line[:column]` parser 与 `Mod+G` editor keymap；输入为当前 selection，输出为 modal open state。验证：focused Vitest 覆盖跨平台 primary modifier binding 与默认值。
- [x] 1.2 [P0, depends: 1.1] 实现居中 modal 的确认、取消、`Enter`、`Escape` 与 safe clamp；输入为 localized user text，输出为 `focusEditorViewAtLocation` 调用。验证：focused Vitest 覆盖有效、非法、越界及取消路径。

## 2. Presentation And Localization

- [x] 2.1 [P1, depends: 1.2] 从 `FileViewBody` 注入所有 locale 的 modal labels，并补充 theme-aware、responsive、accessible CSS。验证：typecheck 与 component assertions 覆盖 `role="dialog"`、accessible labels。
- [x] 2.2 [P1, depends: 2.1] 压缩 modal width/spacing/control density，并加入 decorative `ListOrdered` icon。验证：focused component 与 CSS contract assertions。
- [x] 2.3 [P1, depends: none] 隐藏 tab strip scrollbar chrome，保持 `overflow-x: auto`；tab 直接复用 `getFileTreeIconSvg`。验证：tab render 与 visual contract tests。

## 3. Verification

- [x] 3.1 [P0, depends: 1.1-2.3] 运行本次涉及文件的 focused Vitest、targeted ESLint 与 `npm run typecheck`，修复本变更引入的问题；按用户确认不运行 full test suite。
- [x] 3.2 [P1, depends: 3.1] 运行 `openspec validate add-file-editor-goto-line-shortcut --strict --no-interactive`，记录自动验证结果并保留 desktop manual QA 项。

## Verification Record

- Focused Vitest: 4 files / 92 tests passed。
- Targeted ESLint: passed。
- `npm run typecheck`: passed。
- OpenSpec strict validation: passed。
- Full test suite: 按用户确认未运行。
- Desktop manual QA: 保留 modal compact density、hidden scrollbar scrolling 与 tab/tree icon visual parity 检查。
