# Refine Provider Continuation Header Surface

OpenSpec change: `refine-provider-continuation-header-surface`

## Goal

让 continuation metadata collapsed header 正确避开共享 Canvas topbar，并将 expanded 来源导航
收敛为轻量 icon-only action。

## Requirements

- sticky top 必须复用 `--main-topbar-height`。
- expanded 内容保持精简，折叠可逆。
- 来源 action 无 visible text、border、resting background。
- 保留 `button`、`aria-label`、`title`、keyboard 和 disabled semantics。
- 不修改 Messages 全局 layout/scroll。

## Acceptance Criteria

- [x] collapsed header 位于 topbar 下方并完整可见。
- [x] expanded → collapsed 可逆。
- [x] source action 仅显示 icon，仍能通过 accessible name 查询和触发。
- [x] focused Vitest、typecheck、lint 通过。
- [x] OpenSpec verify、sync、archive 完成。

## Technical Notes

最小 diff 限定为 continuation component/test 和对应 OpenSpec artifacts；避开工作区其他并行改动。
