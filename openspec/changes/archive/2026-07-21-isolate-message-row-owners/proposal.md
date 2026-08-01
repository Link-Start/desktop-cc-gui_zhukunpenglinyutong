## Why

`MessagesRows.tsx` 仍把 message、reasoning、working indicator、memo equality、deferred image lifecycle
和 presentation normalization 放在同一 1800+ 行 owner 中。任何 row 行为修改都会同时触碰 async media、streaming
subscription 与展示 policy，增加 correctness 与 performance regression 风险。

## What Changes

- 把 message comparator 移入独立 pure module，并直接覆盖所有 render-affecting fields。
- 把 deferred image generation、stale guard、object URL ownership 与 cleanup 移入 dedicated hook。
- 建立 pure message presentation model，集中 producer-neutral display derivation。
- 分离 `MessageRow`、`ReasoningRow`、`WorkingIndicator`，保留 row-local live subscription/throttle。
- 将 `MessagesRows.tsx` 收敛为 compatibility exports。

## 验收标准

- `MessagesRows.tsx <= 150` lines，且只保留 compatibility exports。
- async image request identity 与 object URL 生命周期只有一个 hook owner。
- completed row 的无关 object clone 不触发 rerender；所有 render-affecting field 变化会触发。
- live assistant text subscription 留在 `MessageRow`，reasoning throttle 留在 `ReasoningRow`。
- focused/full messages、typecheck、lint、build、boundary 与 large-file gate 通过。
