## 1. Repository-Scoped Preview Wiring

- [x] 1.1 [P0][depends:none][I: multi-repository file rows][O: typed preview callback carrying `repositoryRoot + file + section`][V: `GitMultiRepositoryChanges.test.tsx`] 接通多仓显式 modal preview activation，移除 no-op adapter。
- [x] 1.2 [P0][depends:1.1][I: scoped preview activation + existing `getGitDiffs/getGitFileFullDiff`][O: latest-request-wins modal source, scoped full diff and edit path][V: `GitDiffPanel.test.tsx`] 在 canonical modal host 中加载并呈现 repository-scoped diff，防止 same-relative-path 串仓。

## 2. Compact Multi-Repository Layout

- [x] 2.1 [P1][depends:none][I: single-repository `--git-filetree-*` tokens][O: compact repository header and group spacing without file-row overrides][V: `git-commit-composer-layout.test.ts`] 将多仓 header 高度、padding、gap 与 typography 对齐单仓 `26px` row baseline。

## 3. Verification

- [x] 3.1 [P0][depends:1.2,2.1][I: implementation][O: focused component/style regressions pass][V: `npx vitest run src/features/git/components/GitMultiRepositoryChanges.test.tsx src/features/git/components/GitDiffPanel.test.tsx src/styles/git-commit-composer-layout.test.ts`] 覆盖点击、repository scope、stale response 与视觉密度。
- [x] 3.2 [P0][depends:3.1][I: completed change][O: static and spec gates pass][V: `npm run typecheck`; `npm run lint`; `git diff --check`; `openspec validate fix-multi-repository-git-preview-density --strict --no-interactive`] 完成质量与 OpenSpec 校验。

## 4. Left Preview Scope and Lifecycle Hardening

- [x] 4.1 [P0][depends:1.2][I: selected single-repository `gitRoot` + canonical editable review surface][O: one scope-aware full-diff loader reaches editable baseline reconstruction][V: `WorkspaceEditableDiffReviewSurface.test.tsx`; `WorkspaceEditableDiffCompare.test.tsx`; `GitDiffPanel.test.tsx`] 修复左侧 preview loading 与 full diff scope drift。
- [x] 4.2 [P0][depends:4.1][I: workspace/root/mode context changes + pending preview request][O: stale generation invalidation and old modal teardown][V: `GitDiffPanel.test.tsx`] 防止 workspace/root 切换后旧 preview 串仓或重新打开。
- [x] 4.3 [P0][depends:4.2][I: hardened implementation][O: focused regression, static checks and strict spec validation pass][V: focused Vitest; `npm run typecheck`; `npm run lint`; `git diff --check`; OpenSpec strict validation] 完成本轮兼容性与边界门禁。
