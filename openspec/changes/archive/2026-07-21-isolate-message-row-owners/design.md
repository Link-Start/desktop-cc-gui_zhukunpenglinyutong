## Decisions

### Move by ownership, not visual grouping

先提取 pure equality 和 async media hook，再移动 component。这样 correctness owner 可独立测试，component
迁移保持 hook order 与 DOM contract，不把 logic change 混入大段 move diff。

### Row-local streaming boundary

`useLiveAssistantText` 继续由 `MessageRow` 订阅；`useDeferredValue` 与 reasoning streaming throttle 继续由
`ReasoningRow` 持有。不得提升到 timeline 或 `MessagesCore`，避免高频 state 重新进入上层 render chain。

### Deferred image ownership

`useDeferredMessageImages` 负责 request generation、scope identity、stale commit guard、owned object URL tracking、
replacement revoke 与 unmount cleanup。`MessageRow` 只消费 states/loaded images 并触发 `load`。

### Compatibility surface

现有 callers 继续从 `components/MessagesRows.tsx` import；该文件最终仅 re-export canonical row owners，避免
同一 phase 扩散 import churn。

## Risks / Mitigations

- 大文件拆分漏 import：每个 owner 移动后立即 typecheck，最终 full lint/build。
- comparator drift：先写 direct table-driven tests，并复用 Phase 1 race/context regression。
- hook cleanup 漂移：保留现有 unmount/race tests并增加 hook-focused cleanup evidence。
- DOM/snapshot 漂移：使用 rich-content、stream mitigation、reasoning、runtime reconnect 集成测试锁定。
