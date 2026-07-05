## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `01805ddc`, `a712f0df`, `00bed0a8`。
- 已覆盖实现事实：重设计 settings panel 和 basic appearance sections。
- 已覆盖实现事实：优化 shortcut recording/editing。
- 已覆盖实现事实：统一 vendor/provider panel 色彩。
- 已覆盖实现事实：稳定 settings 相关 idle polling render。
- 已覆盖实现事实：记录当前 Claude thinking forced-visible 行为事实。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/settings-surface-redesign-shortcuts/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-settings-surface-redesign-and-shortcuts --strict --no-interactive`。
