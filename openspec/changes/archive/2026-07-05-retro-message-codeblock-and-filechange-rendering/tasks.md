## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `f80683bd`, `599db468`, `6a4ef2bd`, `1884d0c0`。
- 已覆盖实现事实：抽取 code block language icon/copy affordance。
- 已覆盖实现事实：新增并复用 `FileChangeRow`。
- 已覆盖实现事实：把 file-change evidence 收敛为 per-file compact rows。
- 已覆盖实现事实：Git diff toolbar 和 tool row 使用 shared visual tokens。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/message-codeblock-filechange-rendering/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-message-codeblock-and-filechange-rendering --strict --no-interactive`。
