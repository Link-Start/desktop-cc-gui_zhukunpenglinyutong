# 修复智能体 completion 选择索引错位

## Goal

实现 OpenSpec change `fix-agent-completion-selection-index-alignment`：修复 `#` 智能体列表存在 section header 时，点击或键盘确认选中错误 raw agent 的问题。

## Requirements

- Shared completion hook 的 selectable index 必须对应同一 visible row 的 raw provider item。
- section header / separator 仅参与展示，不参与 selection sequence。
- 不修改 agent provider、persistence、send payload 或 UI 样式。

## Acceptance Criteria

- [ ] 点击 header 后第二个 agent，handler 收到第二个 raw agent。
- [ ] 键盘选择跳过 header，Enter/Tab 收到 active selectable agent。
- [ ] 现有 mapping failure 与普通 completion 行为保持通过。
- [ ] focused tests、typecheck、lint 与 strict OpenSpec validation 通过。

## Technical Notes

在 `useCompletionDropdown` mapping 阶段建立 selectable raw sequence，复用现有 `activeIndex` contract；不引入 dependency。
