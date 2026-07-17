## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal/design/spec delta/tasks/verification for the streaming-render perf pack; output: change artifacts under `openspec/changes/optimize-conversation-streaming-render-perf`; validation: `openspec validate optimize-conversation-streaming-render-perf --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. History-scan caching

- [x] 2.1 Cache `dedupeExitPlanItemsKeepFirst` / `buildMessageActionTargets` across streaming ticks in `Messages.tsx`; fast path only on a trailing message-text-only update, full recompute otherwise. Output: no per-token full-history rescan; idle result unchanged. Validation: typecheck + manual. [P0][depends: 1.1][I][O: Messages.tsx][V: typecheck]

## 3. Snapshot coalescing

- [x] 3.1 Coalesce `item/updated` snapshots per `(workspace, thread, item)` in `events.ts`, guarded by `appServerEventDropPolicy` drop-eligibility. Output: superseded snapshots collapse to newest only when drop-eligible. Validation: `events.test.ts`. [P0][depends: 1.1][I][O: events.ts][V: vitest]

## 4. Compositor-friendly animations

- [x] 4.1 Replace per-frame paints with compositor equivalents (working-text shimmer → opacity; ingress spinner glow → static box-shadow; drop redundant agent-icon drop-shadow). Output: streaming animations off the main thread. Validation: manual. [P1][depends: 1.1][I][O: messages.part1.css, messages.status-shell.css][V: manual]

## 5. Bash output DOM reuse

- [x] 5.1 Key Bash output lines by absolute line index so the sliding truncation window reuses DOM. Output: no wholesale list recreation per line. Validation: manual. [P1][depends: 1.1][I][O: BashToolBlock.tsx, BashToolGroupBlock.tsx][V: manual]

## 6. Verification

- [x] 6.1 Unit coverage for the event coalescing (`events.test.ts`). Output: green. Validation: `npx vitest run src/services/events.test.ts`. [P0][depends: 3.1][I][O: events.test.ts][V: vitest]
- [x] 6.2 Repository JS gates. Output: no TypeScript regressions; scoped messages suite green apart from 2 pre-existing upstream `GenericToolBlock` failures (reproduce on base `ea338fae`, unrelated). Validation: `npm run typecheck` + `npx vitest run src/features/messages`. [P0][depends: 6.1][V: typecheck]
- [x] 6.3 Governance waiver (2026-07-18): a separate trace for this implementation pack is superseded by the shared rebuilt-app trace owned by `harden-conversation-rendering-for-large-history` and `enable-claude-lightweight-streaming-and-frame-attribution`. The code-level contracts remain covered by focused tests; no performance result is claimed here. [P0][depends: 6.2][V: superseded evidence gate]
