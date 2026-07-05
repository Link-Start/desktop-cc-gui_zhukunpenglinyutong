## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `dd5dfa77`, `144563c2`, `c636c564`。
- 已覆盖实现事实：新增 shared marker primitive 和 `ToolMarkerShell`。
- 已覆盖实现事实：迁移 Bash/Edit/Read/Search/MCP/Generic tool blocks 到共享 shell。
- 已覆盖实现事实：统一 collapsed/expanded chrome、marker size、status summary。
- 已覆盖实现事实：修复 MessagesTimeline 中虚拟空行被 tool card layout 影响的问题。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/message-tool-marker-shell/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-message-tool-marker-shell --strict --no-interactive`。
