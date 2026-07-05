## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `9928070d`, `2cd6873e`, `ca830212`, `c6d61eca`。
- 已覆盖实现事实：移除 SearchPalette 右侧 project icon。
- 已覆盖实现事实：精修 SearchPalette、settings nav、sidebar 局部细节。
- 已覆盖实现事实：重构 ReleaseNotesModal header 和 navigation buttons。
- 已覆盖实现事实：Diff panel emphasis color 收敛到 theme token，并减少 inner shadow noise。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/search-release-notes-diff-polish/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-search-release-notes-and-diff-polish --strict --no-interactive`。
