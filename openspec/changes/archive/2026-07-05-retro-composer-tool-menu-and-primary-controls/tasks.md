## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `95bc726a`, `bd00e490`, `524bcf9a`, `d3ca82fa`。
- 已覆盖实现事实：新增 `ComposerBranchBadge`。
- 已覆盖实现事实：把 secondary tools 和 shortcut actions 收纳到 `+` menu。
- 已覆盖实现事实：把 permission mode 和 reasoning depth 暴露在 primary row。
- 已覆盖实现事实：打磨 ChatInputBox layout、toolbar、selectors、HomeChat spacing。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/composer-tool-menu-primary-controls/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-composer-tool-menu-and-primary-controls --strict --no-interactive`。
