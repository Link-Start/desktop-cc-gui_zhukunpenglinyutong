## Context

当前 rich Markdown pipeline 使用 `remark-math + rehype-katex`。`remark-math` 不直接识别 raw `\\[...\\]`，因此 `normalizeCommonMathDelimiters()` 会先将其适配为 dollar delimiters。普通根层级 block 可以正确归一，但下面的 list continuation：

```md
1. 定义：
   \\[
   x^2+y^2
   \\]
```

当前会变成：

```md
1. 定义：
   $$
x^2+y^2
$$
```

opening 与 closing delimiter 因此属于不同 Markdown container。

另一个失败形态来自同一函数内部的 pass ordering：

```md
\[
(\theta,t_x,t_y),
\]
```

standalone block 先正确变成 `$$...$$`，但后续 plain-parentheses heuristic 又产生：

```md
$$
$\theta,t_x,t_y$,
$$
```

这会让 KaTeX 报 `Can't use function '$' in math mode`。

## Goals / Non-Goals

**Goals:**

- 保持现有 delimiter compatibility architecture，不引入新的 Markdown parser 或 micromark extension。
- 对独占一行且成对的 `\\[` / `\\]` 原位转换，并保留 whitespace/blockquote container prefix。
- formula body 原样保留，normalization 前后行数一致。
- 已进入 dollar math range 的内容不得再被 plain-parentheses heuristic 包裹。
- 后续 prose 必须保持普通 Markdown，不得进入 math node 或 `.katex-error`。

**Non-Goals:**

- 不修改原始 Codex JSONL 或 canonical message text。
- 不扩大 `looksLikeInlineLatexExpression()`，本 change 不处理 `\\(q\\)` / `\\(q=60\\)` heuristic。
- 不改变 inline prose 中 `\\[expression\\]` 的既有转换语义。
- 不修改 KaTeX、`remark-math`、`rehype-katex` plugin order 或 CSS。
- 不把 normalization 放回 lightweight streaming hot path。

## Decisions

### Decision 1: line-aware standalone block normalization before generic regex

新增 pure helper 扫描 code region 之外的文本行：

1. delimiter line 只能包含 whitespace、blockquote markers、一个或多个反斜杠和 `[` / `]`；
2. opening 与 closing delimiter 必须成对，并具有相同 container prefix；
3. formula body 继续使用现有 conservative LaTeX predicate；
4. 匹配成功时，仅把两条 delimiter line 改为同 prefix 的 `$$`，body 不重排。

之后仍运行现有 generic regex，以继续支持单行 prose wrapper 和其它已覆盖场景。

### Decision 2: protect established dollar math ranges from nested wrapping

在 plain-parentheses replacement 前，以单次 bounded scan 收集 unescaped `$...$` / `$$...$$` ranges。若候选 offset 位于任一 math range 内，保持原文；range 外仍使用既有 conservative predicate 与 wrapper boundary 判断。

该 guard 只阻止 nested wrapping，不修改公式内容，也不改变 normalizer 的 public API、plugin order 或 canonical message source。

### Decision 3: preserve source line count and shared file-preview behavior

helper 不插入或删除行，因此 message rendering 与 file preview 共用 normalizer 时，file annotation `lineMap` 不发生漂移。测试同时覆盖 DOM rendering 与 file document normalization。

### Decision 4: unmatched or incompatible delimiters remain unchanged

若找不到同 prefix closing delimiter、遇到 nested opener 或 expression 不满足现有 conservative predicate，则 line-aware pass 不改写该 block。generic bracket fallback 识别到 standalone wrapper 时同样保持原文，只继续处理 inline/prose wrapper，从而避免跨 container flattening。

## Risks / Trade-offs

- [Risk] container prefix 判定过宽可能把 prose line 当 delimiter。
  - Mitigation：prefix 只接受 whitespace 与 Markdown blockquote marker，delimiter 必须独占余下整行。
- [Risk] nested/unbalanced delimiters被错误配对。
  - Mitigation：遇到新的 standalone opener 时放弃当前 candidate；unmatched block 保持原文。
- [Risk] shared normalizer 改变 file preview line mapping。
  - Mitigation：原位替换且补充 line-count/line-map regression test。
- [Risk] dollar range guard 误把普通 prose 当 math。
  - Mitigation：只收集成对、unescaped dollar delimiters；single-dollar range 遇到换行即失效，且 guard 只执行 non-mutating skip。
- [Risk] 每次 rich render 增加额外扫描。
  - Mitigation：standalone block 以 `value.includes("\\\\[")` fast path 提前退出；container scan 与 dollar range scan 均为 bounded linear pass，不引入 React state 或 effect。

## Verification Strategy

- Vitest DOM regression：ordered list 内两个 `\\[...\\]` blocks 后 prose 仍存在，存在预期 `.katex-display`，不存在 `.katex-error`。
- Vitest DOM regression：`\\[(\\theta,t_x,t_y),\\]` normalization 不产生 nested `$...$`，并可由 KaTeX 正常 display render。
- File document regression：normalized value 的 opener/body/closer 保持同 prefix，`lineMap` 长度与原 source line count 相等。
- 使用 UUID `019f5fd5-25a4-7521-8949-12d9f6c466f3` 的真实 assistant message 重放 production `Markdown` component，断言 `.katex-error` 为 0。
- Focused tests 后运行 `npm run typecheck`、`npm run lint` 和项目 test gate。
