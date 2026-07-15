## 1. Message fallback implementation

- [x] 1.1 [P0, depends: none] 输入 normalized file-change entry 与 lazy preview loader；输出 `FileChangeRow` 在 preview 无可渲染行时调用 optional canonical navigation、合法 preview 仍只展开；验证 `FileChangeRow.test.tsx` focused cases。
- [x] 1.2 [P0, depends: 1.1] 输入 `GenericToolBlock` 的 normalized kind；输出仅 `added` row 始终保留 optional `onOpenDiffPath`，其他 kind 行为不变；验证 `GenericToolBlock.test.tsx` focused cases。

## 2. Contract and quality gates

- [x] 2.1 [P1, depends: 1.1, 1.2] 输入新增 failure matrix；输出 missing diff、unrenderable diff、valid inline diff、non-added、callback failure 回归覆盖；验证 focused Vitest suites 全部通过。
- [x] 2.2 [P1, depends: 2.1] 输入最终代码与 artifacts；输出无 type/lint/spec regression；验证 `npm run typecheck`、目标 ESLint、`git diff --check`、`openspec validate fallback-untracked-added-file-empty-inline-diff --strict --no-interactive`。
