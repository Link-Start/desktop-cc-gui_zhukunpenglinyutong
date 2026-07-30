## 1. Contract And Root-Cause Guard

- [x] 1.1 [P0][depends:none] 更新 `messagesLiveWindow.test.ts` 中 show-all contract。输入：active streaming、`showAllHistoryItems=true`、超限 items；输出：完整 items 与 zero omitted count；验证：targeted unit test 通过。
- [x] 1.2 [P0][depends:1.1] 修复 `buildLiveTailWorkingSet()` 的统一裁剪条件。输入：`isThinking`、`showAllHistoryItems`、`visibleWindow`；输出：仅 collapsed live history 使用 bounded tail；验证：working-set unit suite 通过。

## 2. Interaction Regression

- [x] 2.1 [P0][depends:1.2] 在 `Messages.live-behavior.test.tsx` 增加 active streaming 点击回归。输入：超过 working-set 上限的 live items；输出：点击 indicator 后最早消息出现且 indicator 消失；验证：component test 通过。

## 3. Quality Gates

- [x] 3.1 [P0][depends:2.1] 运行 targeted Vitest。输入：working-set unit 与 Messages live behavior suites；输出：全部通过。
- [x] 3.2 [P1][depends:3.1] 运行 frontend typecheck。输入：当前 TypeScript worktree；输出：零 type errors。
- [x] 3.3 [P0][depends:3.2] 执行 OpenSpec strict validation 并复核 diff。输入：`fix-live-history-reveal-click` artifacts 与 implementation diff；输出：validation 通过且无越界修改。
