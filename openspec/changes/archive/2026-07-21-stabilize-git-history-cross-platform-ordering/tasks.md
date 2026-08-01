## 1. Cross-platform deterministic ordering

- [x] 1.1 [P0, 无依赖] 输入 repository roots 与 Git branch identities，输出 locale-independent comparator，并在 shared color utility 与 Git History tree 复用；用 unit/component tests 验证。
- [x] 1.2 [P0, 依赖 1.1] 输入 Windows separator、case、Unicode 与 initial color collision roots，输出 input-order-independent slot mapping 和 stable group/leaf order；用 focused Vitest 验证。

## 2. Review closure

- [x] 2.1 [P0, 依赖 1.2] 运行 Git History/Composer focused tests、scoped ESLint、typecheck、runtime/static/large-file contracts 与 strict OpenSpec validation；不跑全量 tests。
- [x] 2.2 [P1, 依赖 2.1] 更新 verification，审查仅暂存本 change 文件，提交中文 Conventional Commit 并执行 Trellis session record。
