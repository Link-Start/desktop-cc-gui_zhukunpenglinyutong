# Fix Provider Continuation Header Collapse

OpenSpec change: `fix-provider-continuation-header-collapse`

## Goal

修复 Provider Continuation Canvas metadata row 在 Messages 吸底时被顶栏剪裁，以及展开后
`summary` 移出可视区域而无法再次折叠的问题。

## Requirements

- metadata row 折叠和展开时 header 均完整可见、可操作。
- 保留原生 `<details>/<summary>` 语义。
- 不修改 Messages 全局 scroll/anchor 行为。
- 不影响来源导航和 missing-source disabled 状态。

## Acceptance Criteria

- [x] collapsed → expanded → collapsed 可逆。
- [x] row 使用 scroller 内 sticky layout，具备稳定 stacking/background。
- [x] focused Vitest、typecheck、lint 通过。
- [x] OpenSpec strict validation、verify、sync、archive 完成。

## Technical Notes

复用现有 Tailwind utilities 和 timeline-leading slot，不新增 dependency 或 React state。
