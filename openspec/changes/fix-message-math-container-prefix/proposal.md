## Why

消息区会在进入 `remark-math` 前把显式 `\\[...\\]` display delimiters 归一为 `$$...$$`。当前 multiline replacement 会丢失 ordered list、nested list 或 blockquote continuation line 的 Markdown container prefix，导致 opening delimiter 留在容器内、closing delimiter 退回根层级。随后 `remark-math` 跨段错误配对，KaTeX 将正文渲染为红色 `.katex-error`。

同一 normalization pass 还有第二个局部冲突：standalone `\\[...\\]` 已转换成 dollar display math 后，plain-parentheses heuristic 仍会继续扫描其 body，把行首 `（\\theta,...）` / `(\\theta,...)` 再包成 `$...$`。KaTeX 因而在 math mode 内遇到 literal `$`，只在这类 display body 上报错，这也解释了为什么大部分 `\\[...\\]` 可以正常渲染而少数失败。

## What Changes

- 在现有 Markdown math normalization 架构内，增加 line-aware standalone `\\[...\\]` block normalization。
- 仅原位替换成对 delimiter lines，并保留 opening/closing line 的原 container prefix；formula body 与行数保持不变。
- plain-parentheses heuristic 在已形成的 `$...$` / `$$...$$` range 内 MUST skip，避免对 display body 做 nested dollar wrapping。
- 保留现有 inline `\\[...\\]`、`\\(...\\)`、`$$...$$`、fenced code 与 lightweight streaming 行为。
- 增加 ordered-list fixture、parenthesized display body 与 file-preview line mapping regression coverage。

## Capabilities

### Modified Capabilities

- `message-markdown-latex-compatibility`: display delimiter normalization 必须保持 Markdown container boundary，且 established math range 不得被后续 inline heuristic 二次包裹。

## Impact

- Frontend implementation: `src/features/markdown/markdownMath.ts`
- Message regression tests: `src/features/messages/components/Markdown.math-rendering.test.tsx`
- File-preview regression tests: `src/features/files/utils/fileMarkdownDocument.test.ts`
- 无新依赖、无 persisted data migration、无 backend contract change。
