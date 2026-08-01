# Verification

## Status

Complete on 2026-07-21.

## Evidence

- `Messages.tsx` is an 8-line compatibility façade; `MessagesCore.tsx` consumes only grouped
  `conversation/runtime/interactions/presentation` input.
- Adapter and conversation-state regression: 2 files、14 tests passed.
- Phase-focused regression including layout/public-index callers: 5 files、50 tests passed.
- Full messages regression: 61 files、587 tests passed、7 skipped.
- `npm run typecheck`: passed.
- `npm run lint -- --max-warnings=0`: passed.
- `npm run build`: passed; only existing CSS、dynamic-import and chunk-size warnings remain.
- `npm run check:messages-boundaries`: `inbound=3 baseline=3`、`outbound=61 baseline=61`、`new=0`.
- `npm run check:large-files:gate`: passed with the repository's existing 51 findings. The
  `Messages.tsx` baseline identity was transferred to the mechanically renamed `MessagesCore.tsx`
  without increasing its recorded 2349-line allowance; current core is 2746 lines and remains below
  the feature-hotpath 2800-line hard threshold pending Phase 3 decomposition.
- `git diff --check`: passed.
- Independent `codex review --uncommitted`: no blocking issues; reviewer independently reran
  typecheck、lint、targeted tests、boundary、large-file report and production build.

## Contract Notes

- A canonical state wins only when every non-empty legacy scope agrees with canonical metadata.
- Explicit canonical empty collections are preserved and never replaced by legacy arrays.
- Mismatched canonical state falls back to legacy items、plan、queue、engine and working metadata.
- The public index exports only `Messages`、`MessageForkConfirmDialog`、`MessagesProps` and
  `AgentTaskScrollRequest`.
