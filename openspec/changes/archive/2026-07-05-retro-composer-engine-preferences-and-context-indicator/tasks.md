## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `d94ad984`, `b9a10e40`, `908b7000`。
- 已覆盖实现事实：持久化 per-engine composer preferences。
- 已覆盖实现事实：保留 provider/model override precedence。
- 已覆盖实现事实：重做 context usage indicator。
- 已覆盖实现事实：抽取 `ClaudeContextCard` 并降低 Composer/Messages chrome 耦合。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/composer-engine-preferences-context-indicator/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-composer-engine-preferences-and-context-indicator --strict --no-interactive`。
