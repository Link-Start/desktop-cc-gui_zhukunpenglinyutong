## 1. Lock parity behavior

- [x] 1.1 Run realtime/history parity、conversation normalization and relevant history loader baselines.
- [x] 1.2 Run messages conversation-state、note-card、rich-content and user-presentation baselines.
- [x] 1.3 Add red-first parity coverage for memory-only、note-card、browser、intent-canvas、image-only and legacy history cases.

## 2. Define and build neutral metadata

- [x] 2.1 Add `ConversationPresentationContext`、memory record and `MessagePresentationMetadata` shared types.
- [x] 2.2 Add pure normalization helpers that preserve raw transport fields.
- [x] 2.3 Normalize realtime assembly and supported history loader outputs to the same metadata contract.

## 3. Consume metadata in messages

- [x] 3.1 Make user/row presentation consume `presentationMetadata` first.
- [x] 3.2 Consolidate legacy raw prompt parsing into one fallback adapter.
- [x] 3.3 Convert context card inputs to neutral view data and remove direct producer parser imports from row/presentation modules.

## 4. Verify and close

- [x] 4.1 Run focused parity/history/messages suites and `check:runtime-contracts`.
- [x] 4.2 Run lint、typecheck、build、messages boundary、large-file evidence and diff check.
- [x] 4.3 Run independent review, resolve findings and record import-count evidence.
- [x] 4.4 Archive Trellis task and OpenSpec change after commit/session recording.
