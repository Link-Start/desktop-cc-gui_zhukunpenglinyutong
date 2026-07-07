# Verification

## Passed

- `npm exec vitest run src/features/debug/hooks/useDebugLog.test.tsx src/services/rendererDiagnostics.test.ts src/features/threads/hooks/useThreadEventHandlers.test.ts`
  - Result: 3 files passed, 89 tests passed.
- `npm run typecheck`
  - Result: passed.
- `openspec validate fix-diagnostics-idle-cpu-storm --strict --no-interactive`
  - Result: passed.
- `npm run lint`
  - Result: passed with one existing warning in `src/features/messages/components/MessagesRows.tsx:914`.

## Blocked / Unrelated

- `npm run test`
  - Result: blocked at batch 17 by existing `src/features/app/components/Sidebar.test.tsx` failure:
    `Sidebar > renders the runtime notice entry in the same bottom action group as settings`.
  - Isolated rerun `npm exec vitest run src/features/app/components/Sidebar.test.tsx` reproduced the same failure.
  - This change does not modify Sidebar files or runtime notice UI ordering.
