## 1. Regression Contract

- [x] 1.1 在 `Markdown.math-rendering.test.tsx` 增加 ordered-list multiline `\\[...\\]` fixture；验证当前实现产生 `.katex-error` 或缺失预期 display math，并锁定后续 prose 不可被吞。
- [x] 1.2 在 `fileMarkdownDocument.test.ts` 增加 shared normalizer regression；验证 delimiter/body container prefix 与 source line mapping 保持稳定。
- [x] 1.3 增加 parenthesized display body regression，锁定 `\\[(\\theta,t_x,t_y),\\]` 不得被二次转换为 nested `$...$`。

## 2. Normalizer Fix

- [x] 2.1 在 `markdownMath.ts` 增加 line-aware standalone bracket display block helper，只原位转换相同 container prefix 的成对 delimiters。
- [x] 2.2 将 helper 接入 `normalizeCommonMathDelimiters()`，保留 generic inline/fallback normalization 和 code-region boundary。
- [x] 2.3 在 plain-parentheses heuristic 前收集 dollar math ranges，并跳过 range 内候选，防止 nested dollar wrapping。

## 3. Verification

- [x] 3.1 运行 focused Markdown/file-preview Vitest，记录 RED 与 GREEN evidence。
- [x] 3.2 运行 `npm run typecheck`、`npm run lint`、`npm run test`，记录结果及任何与本 change 无关的既有失败。
- [x] 3.3 尝试 strict OpenSpec validation，并在 `verification.md` 记录 CLI / fallback validator 的环境阻塞与 remaining manual risk。
