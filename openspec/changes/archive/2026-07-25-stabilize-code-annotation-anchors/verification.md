# Verification

## Automated evidence

- `pnpm vitest run src/features/code-annotations/utils/codeAnnotations.test.ts src/features/files/components/FileViewPanel.part7.test.tsx src/features/files/components/FileViewPanel.part8.test.tsx src/features/git/components/GitDiffPanel.part7.test.tsx`
  - 4 files / 44 tests passed.
- `pnpm run typecheck`
  - passed.
- touched-file ESLint
  - passed.
- `git diff --check`
  - passed.
- `openspec validate stabilize-code-annotation-anchors --strict --no-interactive`
  - passed.

## Review

- 首轮测试发现 `handleConfirmAnnotationDraft` 在 `content` 初始化前形成 TDZ，已移动到
  `useFileDocumentState` 后并重跑通过。
- edit mode 使用 `editorDraftContentRef.current` 创建 anchor，避免未 publish 的编辑内容生成旧 snapshot。
- diff annotation 由 `annotationDraft.lineRange` 反查 new-side exact lines，兼容单行按钮与多行选区。
- relocation 固定 ±120 行且只接受 exact snapshot；重复候选必须由 context fingerprint 唯一消歧，
  无唯一结果返回 `stale`。
- 无新增 dependency；历史无 anchor annotation 保持原行号与原 prompt 格式。
