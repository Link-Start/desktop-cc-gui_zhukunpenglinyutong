## 1. Freeze ownership behavior
- [x] 1.1 Add direct comparator tests for every render-affecting message field and irrelevant clones.
- [x] 1.2 Lock deferred image stale request、scope switch、replacement revoke and unmount cleanup behavior.

## 2. Extract pure/state owners
- [x] 2.1 Move equality helpers to `rows/presentation/messageRowEquality.ts`.
- [x] 2.2 Move deferred image lifecycle to `rows/hooks/useDeferredMessageImages.ts`.
- [x] 2.3 Move pure display derivation to `rows/presentation/messageRowPresentation.ts`.

## 3. Split components
- [x] 3.1 Move `MessageRow` while keeping live text subscription row-local.
- [x] 3.2 Move `ReasoningRow` with its deferred/throttle behavior.
- [x] 3.3 Move `WorkingIndicator` with heartbeat/timer cleanup.
- [x] 3.4 Convert `MessagesRows.tsx` to compatibility exports only.

## 4. Verify
- [x] 4.1 Run focused row/media/reasoning/runtime tests and the full messages suite.
- [x] 4.2 Run typecheck、full lint、production build、boundary、large-file gate and diff check.
- [x] 4.3 Record line counts、review evidence and baseline qualifiers.
