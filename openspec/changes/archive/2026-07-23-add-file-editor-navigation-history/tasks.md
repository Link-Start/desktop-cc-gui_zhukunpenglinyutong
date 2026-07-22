## 1. Semantic History Core

- [x] 1.1 [P0] 在 `useFileNavigation` 内实现 scoped ordered history + cursor；输入为 semantic source/target locations，输出为 Back/Forward availability 与 traversal callbacks；验证 `A -> B -> C`、branch truncation、same-file no-record。
- [x] 1.2 [P0, depends: 1.1] 隔离 owned file transitions；输入为 hook 发起的 expected target 与实际 `filePath` 变化，输出为 semantic transition 保留、manual/external transition 清链；验证 tab/file-tree-style activation 不进入 history。

## 2. Header Controls And Shortcuts

- [x] 2.1 [P1, depends: 1.1] 将 main File Editor leading action 替换为 Back / Forward controls，并保留 Detached File Explorer supplied leading action；验证 aria label、tooltip、disabled state 与原 sidebar toggle。
- [x] 2.2 [P1, depends: 1.1] 复用 shortcut utilities 接入 `cmd+alt+arrowleft/right` platform mapping；验证 macOS Meta+Alt 与 Windows/Linux Ctrl+Alt，unavailable direction no-op。

## 3. Incremental Verification And Review

- [x] 3.1 [P0, depends: 1.2, 2.1, 2.2] 增加 focused Vitest coverage 并执行 affected FileViewPanel tests、`npm run typecheck`、`npm run lint`；输出为增量验证 evidence，不运行全量 test suite。
- [x] 3.2 [P0, depends: 3.1] 按 Trellis `check` 做一轮 changed-code review，修复 findings 后重跑受影响 checks；输出为无未处理 correctness/regression finding 的 diff。
- [x] 3.3 [P1, depends: 3.2] 执行 `openspec validate add-file-editor-navigation-history --strict --no-interactive` 与 artifact/implementation verify；输出为可归档前的完整性、正确性、一致性结论。
