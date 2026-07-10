# Tasks

## 1. Live assistant text externalization

- [x] 1.1 Add a transient `liveAssistantTextChannel` for active assistant body text updates.
- [x] 1.2 Add `useLiveAssistantText` as the message-row subscription path.
- [x] 1.3 Keep final transcript convergence on the existing reducer/history settlement path.

## 2. Root render and refresh pressure reduction

- [x] 2.1 Move Git status refresh from per-message activity to turn settlement.
- [x] 2.2 Convert root-mounted debug/task/orchestration stores to event-driven updates with slow fallback polling.
- [x] 2.3 Keep equality guards so unchanged store snapshots preserve object identity.

## 3. Verification and documentation

- [x] 3.1 Add focused tests for live text channel publish/subscribe and hook cleanup.
- [x] 3.2 Add focused tests for affected debug/task store refresh behavior.
- [x] 3.3 Document render jank evidence and live text externalization plan under `docs/perf/`.
