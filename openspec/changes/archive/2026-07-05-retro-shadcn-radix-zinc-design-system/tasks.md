## Retroactive Implementation

- [x] 代码已经通过既有 commits 落地: `c4f9de84`。
- 已覆盖实现事实：以 `src/components/ui/**` 作为通用 UI primitive 的 canonical layer。
- 已覆盖实现事实：把常用控件的交互语义交给 radix-backed components，例如 `select`、`tabs`、`tooltip`、`switch`、`checkbox`、`dialog`、`field`。
- 已覆盖实现事实：让 dark/light/system theme 共享 zinc-compatible token，减少 feature CSS 自己硬编码颜色和 focus 样式。
- 已覆盖实现事实：保留各 feature 的业务组件边界，只把可复用基础控件下沉到 shared primitive 层。
- [x] 用户确认当前最新代码已经测试，新的功能和优化体验满意。

## OpenSpec Backfill

- [x] 补写 `proposal.md`，以中文为主记录 Why / What Changes / Impact。
- [x] 补写 `design.md`，记录已落地实现背后的设计边界、风险和 guardrails。
- [x] 补写 `specs/client-design-system-zinc-primitives/spec.md`，将行为固化为可验证 requirements。
- [x] 补写 `tasks.md`，明确这是 retroactive backfill，不重新改业务代码。
- [x] Run `openspec validate retro-shadcn-radix-zinc-design-system --strict --no-interactive`。
