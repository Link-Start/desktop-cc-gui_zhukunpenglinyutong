## Verification

### 完整性

- 7/7 implementation tasks complete。
- 2/2 delta requirements 已映射到 implementation 与 focused tests。
- 未新增 dependency、backend command 或 persistence field。

### 正确性

- `FileCodeMirrorEditorHandle.expandSelection()` 复用 `selectParentSyntax`，focused test 覆盖 selection expansion 与 focus。
- `FileViewPanel` 仅在可用 edit view 中展示 action，覆盖 default shortcut、`null` shortcut 与 preview hidden 场景。
- `RendererContextMenu` shortcut slot 为 decorative presentation，不改变 accessible action label。
- `.fvp-file-context-menu` 保持 `overflow-y: auto`，并覆盖 Firefox、Chromium/WebKit scrollbar hiding rules。

### 一致性

- CodeMirror state-coupled import 保留在 lazy implementation，未跨越 `FileCodeMirrorEditor` boundary。
- shortcut hint 复用 `formatShortcutForPlatform`。
- 10 个 supported locale files key parity 通过。

### Automated Evidence

- `npx vitest run src/features/files/components/FileCodeMirrorEditorImpl.test.ts src/components/ui/RendererContextMenu.test.tsx src/features/files/components/FileViewPanel.test.tsx src/styles/file-view-panel-visual-contract.test.ts src/i18n/index.test.ts`：5 files / 124 tests passed。
- focused final rerun：4 files / 119 tests passed。
- `npm run typecheck`：passed。
- incremental ESLint on touched TypeScript/locales：passed。
- `git diff --check`：passed。
- `openspec validate expose-expand-selection-context-menu --strict --no-interactive`：passed。
- `openspec validate app-shortcuts client-scrollbar-visual-consistency` 使用独立 targeted commands：passed。

### Scope Note

- 按用户要求未运行 full test suite。
- 未执行 Git commit。
