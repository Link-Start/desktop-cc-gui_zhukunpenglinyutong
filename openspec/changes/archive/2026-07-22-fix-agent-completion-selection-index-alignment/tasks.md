## 1. Shared Completion Contract

- [x] 1.1 [P0][depends:none] 输入 `useCompletionDropdown` 的 mapped presentation items 与 raw provider results；输出只包含 selectable raw items 的 selection sequence；验证 section header / separator 不占用 `activeIndex`。

## 2. Regression Coverage

- [x] 2.1 [P0][depends:1.1] 输入带 section header / separator 的两个 agent fixtures；输出 mouse `selectIndex(1)` 选择第二个 agent 的回归测试；验证 handler 收到第二个 raw item。
- [x] 2.2 [P0][depends:1.1] 输入同一 fixtures 并执行 ArrowDown；输出 Enter / Tab 均跳过 presentation-only items 的回归测试；验证 handler 收到 active selectable raw item。

## 3. Verification

- [x] 3.1 [P0][depends:2.1,2.2] 运行 focused Vitest、`npm run typecheck`、`npm run lint` 与 strict OpenSpec validation；输出全部 gate 结果并审计 diff 不涉及 provider、persistence、payload 或 CSS。
