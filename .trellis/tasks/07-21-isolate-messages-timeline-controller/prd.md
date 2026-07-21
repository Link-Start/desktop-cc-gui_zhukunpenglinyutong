# Isolate Messages Timeline Controller

## Objective

执行 roadmap Phase 4：将 `MessagesTimeline.tsx` 按 row dispatch、virtualizer、hydration 与 outline ownership
拆分，同时保持 projection、DOM、React key、scroll、long-history virtualization、live rendering 与 diagnostics 行为。

## Acceptance

- `MessagesTimeline.tsx` 首轮降到 1600 行以下。
- `TimelineRowRenderer` 只负责 projection-row switch 与 row-specific prop mapping。
- keyed measurement callback 对 unchanged row key 保持 stable identity。
- virtualizer、hydration、outline 分属独立 hook owner，scope reset 与 cleanup 明确。
- `SHOW_OUTLINE_FLOATER = false` 时保持 no-listener contract。
- focused/full tests、typecheck、full lint、build、boundary、large-file evidence 与 review 完整。
