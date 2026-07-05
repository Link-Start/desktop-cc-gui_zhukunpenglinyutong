## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `8f16b5d9`, `5c225ff5`, `e2ce2d6f`, `521e7178`, `8f1d4fe2`, `e0f2c1a6`, `f59a7543`。
- 已覆盖实现事实：ThreadList subagent 默认折叠与排序调整。
- 已覆盖实现事实：Header toolbar 支持 pin open-app actions。
- 已覆盖实现事实：MainHeader 移除 branch/worktree 管理 UI。
- 已覆盖实现事实：Plan panel 默认 collapsed，线程切换时保持。
- 已覆盖实现事实：PanelTabs visible state 与 transient live state 解耦。
- 已覆盖实现事实：Sidebar 新增 version tag 和 disabled plugin coming-soon entry。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/header-sidebar-panel-navigation-chrome/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-header-sidebar-and-panel-navigation-chrome --strict --no-interactive`。
