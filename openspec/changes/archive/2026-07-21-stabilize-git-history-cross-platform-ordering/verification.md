## Verification Summary

本 change 已完成 review 与 focused verification。修复将 repository color collision resolution、branch group 与 branch leaf ordering 从 host-dependent `localeCompare()` 收敛为 locale-independent UTF-16 code-unit ordering；不修改 repository/branch identity、Git commands、backend path contract 或 UI hierarchy。

## Automated Evidence

- `pnpm vitest run src/features/git/utils/gitRepositoryIconColors.test.ts src/features/git-history/components/git-history-panel/components/GitHistoryMultiRepositoryBranchTree.test.tsx src/features/git-history/components/GitHistoryPanel.test.tsx src/features/composer/components/ComposerBranchBadge.test.tsx`
  - 4 files / 77 tests passed。
- scoped `pnpm eslint`：通过。
- `pnpm typecheck`：通过，无 TypeScript diagnostics。
- `pnpm run check:runtime-contracts`：通过。
- `pnpm run check:git-history:static-imports`：通过。
- `pnpm run check:large-files`：命令通过，本 change 文件未触发 size regression。
- `openspec validate stabilize-git-history-cross-platform-ordering --strict --no-interactive`：通过。

## Compatibility Review

- Windows：保留 `services\\api` exact identity，不在 UI 层转换 separator。
- macOS / Linux：ordering 不依赖系统 locale 或 ICU collation version。
- case / Unicode：严格保留原始 string identity；不做 case folding 或 Unicode normalization。
- input order：已知 initial color collision roots 在正序/逆序输入下得到相同 slot mapping。

## Scope

未运行全量 tests，符合用户要求。未修改或纳入 workspace 中并行的 shortcuts change。
