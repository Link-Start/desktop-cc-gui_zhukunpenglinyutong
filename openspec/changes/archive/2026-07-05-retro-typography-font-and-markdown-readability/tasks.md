## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `aad3d7a3`, `9d480e77`。
- 已覆盖实现事实：引入 `src/assets/fonts/Geist-Variable.woff2` 和 `geist.css`。
- 已覆盖实现事实：通过 `typographyCssVars` 和 `fonts.ts` 统一 UI 字体变量。
- 已覆盖实现事实：调整 Markdown message styles，提升段落、代码、列表的阅读节奏。
- 已覆盖实现事实：保留 settings 中用户字体/字号配置的既有语义。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/client-typography-and-markdown-readability/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-typography-font-and-markdown-readability --strict --no-interactive`。
