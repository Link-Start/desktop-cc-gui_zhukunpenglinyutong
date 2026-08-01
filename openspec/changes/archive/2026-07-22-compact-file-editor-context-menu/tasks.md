## 1. Compact menu styling（P0）

- [x] 1.1 [依赖: 无] 输入已有 `.fvp-file-context-menu` modifier，输出 scoped outer padding、item height/padding、separator spacing 与 icon geometry overrides；用 CSS contract 验证 exact values 和 scrolling preservation。

## 2. Incremental verification（P0）

- [x] 2.1 [依赖: 1.1] 运行 focused CSS contract、TypeScript、incremental ESLint、`git diff --check` 与 strict OpenSpec validation；不运行 full suite。
- [x] 2.2 [依赖: 2.1] 执行 `openspec-verify-change`、同步 main spec 并归档 change。
