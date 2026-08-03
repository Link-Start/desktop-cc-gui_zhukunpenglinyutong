# Proposal: refactor-conversation-canvas-scroll-ownership

## Why

消息幕布滚动长期以路径级止血叠加（echo 指纹、2.4s settle 窗、stick 资格补丁），导致 **A 类发送飞顶** 与 **F 类回合结束后离真底** 间歇复现。根因不是会话长短，而是 **多层并行写 `scrollTop`、Owner 生命周期与几何稳态错位**。需要在共同幕布（全 CLI + Shared 一核）做 **Scroll Ownership 编排重构**，而不是再加 guard。

权威设计：`docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md`。

## What Changes

- 引入 **ViewportMode + Authority 纯状态机**（Intent / Geometry → mode / ticket / pin 决策）。
- 引入 **WriteTicket**（代际 + applied ring + safetyTimeout）；程序写入可识别，clamp 用几何证明。
- **forced 退役** = 几何稳态 + 真底(≤1px)，**禁止**以固定 2.4s 为正确性条件；safetyTimeout 仅安全阀。
- **forced 期内 UserScroll 仲裁**：明确上滚打断 → free；噪声/回声/clamp 不打断。
- 焦点跟随开/关 **退役落点** 合同化。
- Controller 接线 Single Writer 语义；Messages 时间线 scroller 归口；子工具块 scroller 范围外。
- 扩展回归：状态机单测 + 既有 live-behavior 语义保留 + A/F 场景。
- **不 BREAKING** 对外 API；行为向「真底更稳、误杀 follow 更少」收敛。

## 目标与边界

- **目标**：A/F 由同一 Owner 状态机闭环；间歇性可用 reason code 解释；全 CLI 一核。
- **边界**：仅 messages 滚动编排；不按引擎分叉；不换 virtuoso / 不整库 stick-to-bottom。

## 非目标

- 不重做 tool 投影 / presentation 轻量墙（另 change）。
- 不把工具块内部 scroller 并入幕布 Owner。
- 不按 messageCount 分策略。
- 不以加长 `SETTLE_REPIN_WINDOW_MS` 为默认修复。

## 方案取舍

| 选项 | 说明 | 结论 |
|------|------|------|
| A. 继续路径止血 | 再补 if/grace | **否决**（已多次失败） |
| B. 引入 use-stick-to-bottom 依赖 | 吸收 RO stick | **否决**（无 turn boundary / 虚拟化合同） |
| C. **自研 Authority + Ticket + 现有 convergence** | 对齐 DESIGN | **采用** |

## Capabilities

### New Capabilities

- `conversation-canvas-scroll-ownership`：ViewportMode、Intent 仲裁、WriteTicket、几何稳态退役、真底合同。

### Modified Capabilities

- `conversation-live-message-canvas-rendering`：settle/send 贴底从「时间窗」升级为「稳态/安全阀 + Owner」；保留 echo 兼容期内行为不回退。

## 验收标准

- 纯函数状态机单测覆盖：forced 仲裁、稳态退役、safetyTimeout、ticket 回声、clamp。
- 既有 `Messages.live-behavior` / echo / thrash 相关用例保持绿（或等价迁移）。
- `openspec validate refactor-conversation-canvas-scroll-ownership --strict`。
- typecheck 通过；聚焦 vitest 通过。
- 人工：A 发送不飞顶；F 结束后 `distanceToBottom` 贴真底（开/关跟随对照）——**完成后通知用户测**。

## Impact

- 代码：`src/features/messages/orchestration/scrolling/*`、`useMessagesScrollController.ts`、必要时 `MessagesCore.tsx`。
- 文档：设计已在 `docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md`。
- 依赖：无新 npm 包。
