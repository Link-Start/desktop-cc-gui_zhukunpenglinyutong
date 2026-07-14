## ADDED Requirements

### Requirement: Display Math Delimiter Normalization MUST Preserve Markdown Container Boundaries

消息区在把显式 `\\[...\\]` display delimiters 适配为 `remark-math` 支持的内部表示时，MUST 保留公式所在的 Markdown container boundary，且 MUST NOT 改写 canonical message source。

#### Scenario: ordered-list display block keeps one container prefix

- **WHEN** ordered list item 的 continuation lines 包含独占一行的 `\\[`、formula body 与 `\\]`
- **THEN** normalization MUST 让 opening delimiter、formula body 与 closing delimiter 保持在同一 list container
- **AND** formula MUST 渲染为 display math
- **AND** 后续 prose MUST remain outside the math node
- **AND** render output MUST NOT contain `.katex-error` caused by delimiter cross-pairing

#### Scenario: blockquote or nested container remains structurally stable

- **WHEN** standalone display delimiters 位于 whitespace/blockquote container prefix 内
- **THEN** normalization MUST preserve the exact delimiter-line container prefix
- **AND** normalization MUST NOT flatten the formula block to the document root

#### Scenario: unmatched delimiter remains non-destructive

- **WHEN** standalone opening delimiter 没有兼容的 closing delimiter
- **THEN** the line-aware normalization pass MUST leave that candidate unchanged
- **AND** it MUST NOT consume subsequent prose as a synthesized math block

#### Scenario: file-preview source mapping remains stable

- **WHEN** shared Markdown normalization processes a matched standalone display block
- **THEN** normalized line count MUST equal source line count
- **AND** file-preview `lineMap` MUST continue to map every normalized line to its original source line

### Requirement: Established Math Ranges MUST NOT Be Wrapped Again

一旦 normalization 已经建立 `$...$` 或 `$$...$$` math range，后续 compatibility heuristic MUST treat its body as math content and MUST NOT inject nested dollar delimiters。

#### Scenario: parenthesized LaTeX inside display math is not wrapped again

- **WHEN** standalone `\\[...\\]` display body 以 `(\\theta,t_x,t_y)` 或等价 parenthesized LaTeX 开头
- **THEN** normalization MUST preserve the parentheses as part of the display expression
- **AND** plain-parentheses heuristic MUST NOT insert nested single-dollar delimiters inside the display math range
- **AND** render output MUST NOT contain a `.katex-error` caused by literal `$` in math mode
