# Isolate Message Row Owners

## Objective

执行 roadmap Phase 5：将 `MessagesRows.tsx` 按 equality、async deferred media、pure presentation、
MessageRow、ReasoningRow 与 WorkingIndicator ownership 拆分，同时保持 DOM、memo、streaming 与 recovery 行为。

## Acceptance

- `MessagesRows.tsx` 最终只保留 compatibility exports，且不超过 150 行。
- comparator 对全部 render-affecting field 敏感，对等价 completed item clone 可复用。
- deferred image hook 独占 request generation、scope stale guard、URL revoke 与 unmount cleanup。
- `useLiveAssistantText` 保持在 MessageRow；reasoning throttle/deferred value 保持在 ReasoningRow。
- focused/full tests、typecheck、full lint、build、boundary、large-file gate 与 review evidence 完整。
