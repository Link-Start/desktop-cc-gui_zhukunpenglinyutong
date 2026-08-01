# Verification

## Status

Completed on 2026-07-21.

## Evidence

- Focused regression: `3 files / 48 tests passed` after the live-text memo fix.
- Full messages suite: `64 files passed`; `602 tests passed`; `7 tests skipped`.
- `npm run typecheck -- --pretty false`: passed.
- `npm run lint -- --max-warnings=0`: passed.
- `npm run build`: passed with the repository's existing CSS、dynamic-import and chunk-size warnings.
- `npm run check:messages-boundaries`: `inbound=3`、`outbound=61`、`new=0`.
- `git diff --check`: passed.
- `openspec validate isolate-message-row-owners --strict`: passed.

## Ownership Results

- `MessagesRows.tsx`: 4 lines; compatibility exports only.
- `MessageRow.tsx`: 1008 lines; owns row-local live-text subscription and rendering.
- `ReasoningRow.tsx`: 114 lines; owns reasoning deferred/throttle behavior.
- `WorkingIndicator.tsx`: 173 lines; owns heartbeat/timer cleanup.
- `messageRowPresentation.ts` imports pure browser/parser utilities directly and does not import React components.
- `parseUserTextContent.ts` isolates user-text parsing from `CollapsibleUserTextBlock.tsx`.

## Review

Independent review identified that `liveAssistantText` invalidated the complete static presentation memo on every stream update. The implementation now memoizes immutable item/config derivation separately; a live delta only selects the current display string and derives `hasText`. The focused streaming and presentation regression suite passed after the fix.

## Baseline Qualifier

`npm run check:large-files:gate` reports the repository's existing 51 baseline findings and exits 1. This phase did not add a finding: the existing 2000-line allowance was transferred from `MessagesRows.tsx` to `rows/components/MessageRow.tsx`, whose current size is 1008 lines. The finding count remains 51.
