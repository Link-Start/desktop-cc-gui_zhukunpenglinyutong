## Scope

验证工作区实现与 `fix-multi-repository-git-inline-diff-scope` proposal/design/spec deltas 一致，覆盖 repository-scoped center inline diff、multi-repository unstaged discard-all、diff mode layout 与 Composer branch command header actions。

## Checks Run

### Focused frontend tests

```bash
npx vitest run src/features/composer/components/ComposerBranchBadge.test.tsx src/features/git/components/GitMultiRepositoryChanges.test.tsx src/features/app/hooks/useGitPanelController.test.tsx src/features/layout/components/DesktopLayout.test.tsx
```

Result：4 test files passed，82 tests passed。

### TypeScript

```bash
npm run typecheck
```

Result：passed，无 type errors。

### ESLint

```bash
npm run lint
```

Result：passed，无 lint errors。

### OpenSpec and diff hygiene

```bash
openspec validate fix-multi-repository-git-inline-diff-scope --strict --no-interactive
git diff --check
```

Result：strict validation passed；diff hygiene passed。

归档后 targeted main-spec validation：

```bash
openspec validate multi-repository-git-command-center --strict --no-interactive
openspec validate multi-repository-git-commit-workspace --strict --no-interactive
```

Result：两个同步后的 main specs 均通过 strict validation。

`openspec validate --all --strict --no-interactive` 当前仍被与本 change 无关的既有 active change `fix-claude-cli-native-installer` 阻塞（440 passed / 1 failed）；本次未修改该 change。

### Manual acceptance

用户于 2026-07-23 确认人工测试通过，覆盖当前工作区实现的多仓 Git inline diff scope、discard interaction、diff layout 和 branch header actions。

## Results

- `repositoryRoot + path` 可从 multi-repository changed-file action 传递至 center diff controller。
- scoped local diff 复用 `getGitDiffs(workspaceId, repositoryRoot)` 与 canonical viewer mapper。
- unstaged section discard-all 复用 existing explicit-repository confirmation flow。
- `centerMode === "diff"` 时 bottom Composer 不再占据 center content 高度。
- multi-repository Update All / Checkout All actions 位于 command header，并保留 accessible labels 与原执行语义。
- 无 Rust、Tauri command、storage schema 或 dependency 变更。

## Risks / Follow-ups

- 本次未运行整个 repository Vitest suite；已运行所有直接受影响的 focused suites，并通过全量 lint/typecheck。
- repository-scoped diff 采用按需请求，不增加 cache；后续只有在 runtime evidence 显示重复请求成本显著时再独立提案。
- Change 已于 2026-07-23 同步并归档为 `2026-07-23-fix-multi-repository-git-inline-diff-scope`。
