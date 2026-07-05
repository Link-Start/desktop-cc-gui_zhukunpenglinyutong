## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `de47ee6d`, `95c613fc`。
- 已覆盖实现事实：接入 react-scan diagnostics controller 和设置页开关。
- 已覆盖实现事实：掉帧归因到 recent react-scan renders。
- 已覆盖实现事实：web-vitals collection 改为 runtime-gated。
- 已覆盖实现事实：提供 diagnostics report/export plumbing。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/react-scan-frame-diagnostics/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-react-scan-and-frame-diagnostics --strict --no-interactive`。
