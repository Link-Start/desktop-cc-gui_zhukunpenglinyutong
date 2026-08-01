## Verification Summary

- Automated implementation coverage: complete for the requested incremental scope.
- Incremental code review: no correctness finding in note capture ownership、whole-file fallback、Git scope or menu grouping.
- Full test suite: intentionally not run per user instruction.
- Manual desktop acceptance: pending product-owner validation.

## Requirement Evidence

### Single menu ownership and note capture fallback

- `FileViewBody.tsx` freezes CodeMirror/preview logical selections and delegates through `onFileContextMenu`; it no longer owns `RendererContextMenu` state.
- `FileViewPanel.tsx` composes one note item. Selection draft wins; otherwise it builds a whole-file draft from current CodeMirror document or loaded source.
- blank/truncated content does not expose a misleading whole-file action.

### Repository-scoped Git submenu

- Active file content resolves owning repository identity and exposes one `Git 操作` submenu.
- File History receives workspace id/path、repository root、repository-relative path and display path.
- Git Blame retains existing eligibility/loading/stale/error/toggle behavior inside the submenu.

## Automated Checks

- `npx vitest run src/features/files/components/FileViewPanel.capture-note.test.tsx src/features/files/components/FileViewPanel.git-blame.test.tsx src/features/files/components/FileViewPanel.test.tsx --reporter=dot`
  - PASS: 3 files, 92 tests.
- `npx vitest run src/features/files/components/FileViewPanel.capture-note.test.tsx --reporter=dot`
  - PASS: 1 file, 6 tests, including blank/truncated boundaries.
- targeted `npx eslint` for touched file components/tests and all note-card locale files
  - PASS: 0 errors, 0 warnings after dependency stabilization.
- `git diff --check`
  - PASS.
- `openspec validate integrate-file-note-and-git-context-actions --strict --no-interactive`
  - PASS before main-spec sync; rerun at closure.
- `npm run check:large-files`
  - PASS in report mode; 53 existing repository baseline findings reported, no new file introduced by this change.
- `npm run typecheck`
  - BLOCKED by five concurrent/pre-existing `TS2741` errors in `FileExplorerWorkspace.test.tsx` for missing required `onCloseOtherTabs` props.
  - No TypeScript error references this change's touched implementation, tests, locale files or OpenSpec artifacts.

## Incremental Review Matrix

| Boundary | Evidence | Verdict |
|---|---|---|
| selected edit capture | exact content + source range test | PASS |
| no-selection edit capture | unsaved current document + final line test | PASS |
| preview selection | frozen logical line range test | PASS |
| preview no-selection | complete loaded source test | PASS |
| blank/truncated | whole-file action omitted | PASS |
| popover ownership | exactly one menu assertion | PASS |
| nested Git repository | active content history payload assertion | PASS |
| existing Git Blame lifecycle | focused blame suite | PASS |

## Manual Acceptance

- [ ] 在 Tauri desktop 中验证选中文本右键只出现一个菜单，并可进入 note workbench 草稿。
- [ ] 在 Tauri desktop 中验证无选区保存整个文件，且未保存编辑内容被带入草稿。
- [ ] 在 nested repository 文件中验证 `Git 操作 -> 显示文件历史 / Git Blame`。
- [ ] 验证 light/dark theme、viewport 边缘 positioning 与 Escape/outside-click dismiss。
