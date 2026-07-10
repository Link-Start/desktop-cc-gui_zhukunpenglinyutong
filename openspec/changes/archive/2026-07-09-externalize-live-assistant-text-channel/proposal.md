# Proposal: Externalize Live Assistant Text Channel

## Why

Commit `2fcf9d1a80ce076983cd6817d24941127c81c94a` introduced a broad performance fix for conversation rendering. The behavior is larger than a local rendering optimization: live assistant body text is moved out of the reducer/root render path, several root-mounted stores become event-driven or slow-poll fallback, and Git status refresh is delayed until turn settlement.

This needs an OpenSpec proposal because it changes the runtime contract for how visible live text reaches the message surface. Future work must not accidentally restore per-delta reducer dispatch, per-message root refresh, or high-frequency local store polling.

## What Changes

- Add a `liveAssistantTextChannel` boundary for streaming assistant text so live deltas can update the visible latest assistant row without appending every delta into the root conversation reducer.
- Add `useLiveAssistantText` as the UI subscription path for the latest live assistant text.
- Keep final transcript convergence through the existing thread/reducer/history settlement path; the external channel is a live rendering optimization, not a new durable transcript source.
- Route live assistant text updates through bounded subscribe/publish semantics and test cleanup to avoid cross-thread or cross-test leakage.
- Move Git status refresh from high-frequency message activity to turn settlement, with existing periodic Git status polling as the fallback for external changes.
- Convert root-mounted debug/task/orchestration store reads from frequent polling or per-write render churn into event-driven updates plus slower fallback polling.
- Document the A4 live text externalization plan and renderer jank evidence so future performance work can compare against the same root cause.

## Non-Goals

- Do not change final message ordering, history hydration order, or durable conversation item identity.
- Do not replace the conversation reducer or message assembly contract.
- Do not change provider runtime semantics for Claude, Codex, Gemini, or OpenCode.
- Do not remove existing diagnostics; only reduce hot-path write/render amplification.
- Do not change Git status command behavior outside refresh timing.

## Impact

- Affected specs:
  - `conversation-render-surface-stability`
  - `conversation-realtime-client-performance`
  - `runtime-performance-evidence-gates`
- Affected code from the commit:
  - `src/features/threads/utils/liveAssistantTextChannel.ts`
  - `src/features/threads/hooks/useLiveAssistantText.ts`
  - `src/features/threads/hooks/useThreadItemEvents.ts`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/app-shell.tsx`
  - `src/features/debug/hooks/useDebugLog.ts`
  - `src/features/tasks/hooks/useTaskRunStore.ts`
  - `src/features/agent-orchestration/hooks/useOrchestrationTaskStore.ts`
  - `docs/perf/a4-live-text-externalization-plan.md`
  - `docs/perf/render-jank-knife-experiments-2026-07-08.md`

## Behavior Requirements

- During an active streaming turn, visible assistant text SHALL be able to grow from the external live channel even when the durable conversation item array identity stays stable.
- The external live text channel SHALL be scoped by thread/item identity so updates for one assistant message do not leak into another message or thread.
- Completion/settlement SHALL reconcile the durable conversation state so final transcript semantics do not depend on the external live channel.
- The root app shell SHALL NOT run Git status refresh on every message activity event; it SHALL refresh when a thread transitions from processing to settled, with periodic Git polling remaining as fallback.
- Root-mounted local stores SHALL prefer write-broadcast events plus equality guarded state updates over short fixed polling loops.
- Tests SHALL cover live text channel publish/subscribe behavior, hook cleanup, and affected store refresh semantics.

## Validation

- `src/features/threads/utils/liveAssistantTextChannel.test.ts`
- `src/features/threads/hooks/useLiveAssistantText.test.ts`
- `src/features/debug/hooks/useDebugLog.test.tsx`
- `src/features/tasks/hooks/useTaskRunStore.test.ts`
- `src/features/threads/utils/realtimePerfFlags.test.ts`
- TypeScript typecheck and focused message/thread performance tests.

## Risks / Mitigations

- Risk: live text externalization can hide a durable transcript regression if final settlement is not verified.
  - Mitigation: keep external live text as transient UI state only and continue verifying final reducer/history convergence.
- Risk: channel subscriptions can leak across thread changes.
  - Mitigation: scope by thread/item id and test unsubscription cleanup.
- Risk: slower fallback polling can miss cross-window store updates.
  - Mitigation: broadcast same-window writes immediately and retain slower fallback polling for abnormal or external paths.
