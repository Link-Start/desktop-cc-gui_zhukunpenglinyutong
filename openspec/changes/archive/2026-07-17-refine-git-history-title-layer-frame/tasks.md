## 1. Visible Divider Correction

- [x] 1.1 [P0, depends on: none] 输入用户实机反馈与 theme token 定义，输出修订后的 proposal/design/spec；验证 `--border-default` 局部作用域根因与 `--border-strong` 选择已记录。
- [x] 1.2 [P0, depends on: 1.1] 输入 `.git-history-toolbar` 的无效 border 声明，输出 1px `--border-strong` 横向分隔线；验证 full-width、zero-radius 与其他视觉参数不变。

## 2. Verification

- [x] 2.1 [P0, depends on: 1.2] 运行 `git diff --check`、Git History focused Vitest、`npm run lint` 与 `npm run typecheck`，输出全部 gate 结果。
- [x] 2.2 [P0, depends on: 2.1] 运行 change-specific strict OpenSpec validation 并审阅最终 diff，输出 spec/implementation 一致性结论。

## 3. Compact Height Correction

- [x] 3.1 [P0, depends on: 2.2] 输入用户实机高度反馈与 toolbar control metrics，输出紧凑高度 proposal/design/spec；验证只压缩 container whitespace，不缩小 interactive controls。
- [x] 3.2 [P0, depends on: 3.1] 将 `.git-history-toolbar` vertical padding 从 `8px` 压缩至 `2px`；验证 full-width divider、normal/empty state 与 narrow viewport wrapping 保持不变。
- [x] 3.3 [P0, depends on: 3.2] 运行 `git diff --check`、Git History focused Vitest、`npm run lint`、`npm run typecheck`、large-file gate 与 strict OpenSpec validation。
