## Verification

### Incremental Tests

```text
npx vitest run \
  src/features/messages/presentation/sharedProjection/dataSource.test.ts \
  src/features/shared-session/target/targetStore.test.ts \
  src/features/shared-session/runtime/sendSharedSessionTurnV2.test.ts \
  src/features/threads/contracts/conversationAssembler.test.ts \
  src/features/threads/loaders/sharedHistoryLoader.test.ts \
  src/features/app/hooks/useAppServerEvents.test.tsx
```

Result: 6 files passed, 129 tests passed.

Per user instruction, full test suite was not run.

### Static Gates

- `npm run typecheck`: passed.
- ESLint on touched TypeScript/TSX files: passed.
- `git diff --check`: passed.
- `openspec validate fix-shared-session-canvas-history-parity --strict --no-interactive`: passed.

### Contract Evidence

- Realtime frozen target: `src/features/app/hooks/useAppServerEvents.ts`
- Native-style history convergence: `src/features/threads/assembly/conversationAssembler.ts`
- Shared dual-read integration: `src/features/threads/loaders/sharedHistoryLoader.ts`
- Canonical local/default recovery: `src/features/messages/presentation/sharedProjection/dataSource.ts`
- Local send/freeze normalization: `src/features/shared-session/target/types.ts`

### Cross-Layer Audit

- Shared loader imports no Claude/Codex Native history loader or service.
- No new root hook subscription, polling, interval, or persistence migration.
- Realtime path performs one conditional item object copy only for Shared assistant items with an active frozen target.
- Legacy snapshot remains read-only; convergence is presentation-only.
- Shared constants are reused for local Provider label/source.

### Remaining Manual Check

Recommended product smoke test after packaging:

1. Send one Shared Codex Turn with visible reasoning.
2. Confirm realtime Badge.
3. Reload the Shared Session.
4. Confirm reasoning, order, final answer, and Badge remain unchanged.

This manual smoke test is not an archive blocker because focused automated tests cover the same data-flow contracts.
