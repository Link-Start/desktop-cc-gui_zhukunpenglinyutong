## Why

`MessagesTimeline.tsx` 当前同时拥有 projection row dispatch、virtualizer、heavy-row hydration、outline snapshot、
scroll/render diagnostics 与完整 JSX composition，共 2081 行。row prop wiring 的修改会触碰 virtualization effect，
而 live update 又可能重建 callback refs 或误触 hydration/outline state，增加 long-history 与 streaming regression 风险。

## What Changes

- 将 projection-row switch 与 row-specific prop mapping 移入 `TimelineRowRenderer`。
- 建立 stable row measurement ref registry，避免 unchanged row 因 live props 变化收到 synthetic detach/attach。
- 将 `useVirtualizer`、measurement、scope reset 与 stability recovery 收敛到 dedicated hook。
- 将 heavy-row hydration promotion、retention、bounded remeasure 与 scope cleanup 收敛到 dedicated hook。
- 将 outline snapshot、callback identity、active heading 与 disabled floater contract 收敛到 dedicated hook。
- 将 `MessagesTimeline.tsx` 收敛为 timeline owner composition，首轮目标少于 1600 行。

## 验收标准

- projection row DOM wrappers、React keys、error boundary 与 live probe placement 不变。
- unchanged row 在仅 live props 变化时不发生 `ref(null) -> ref(node)` cycle。
- virtualizer threshold、overscan、estimate 与 stability budget 数值不变。
- hydration active/visible/detail-requested promotion、retained rows 与 bounded remeasure 行为不变。
- `SHOW_OUTLINE_FLOATER = false` 时不安装 active-outline scroll/resize listener。
- focused/full messages、typecheck、lint、build、boundary 与 large-file evidence 完整。
