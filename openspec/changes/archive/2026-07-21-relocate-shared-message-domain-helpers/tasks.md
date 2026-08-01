## 1. Diff Capability

- [x] 1.1 Add dedicated `src/utils/diff.test.ts` for LCS guard, unified headers, empty/equal/trailing newline cases.
- [x] 1.2 Move compute diff APIs/types into `src/utils/diff.ts` and migrate all callers.
- [x] 1.3 Remove messages-private diff implementation after compatibility callers reach zero.

## 2. Domain Contracts

- [x] 2.1 Move `commandMessageTags` and paired tests to `src/utils`.
- [x] 2.2 Move `agentTaskNotification` and paired tests to `engine-task-output/contracts`.
- [x] 2.3 Migrate messages/threads/root callers without behavior drift.

## 3. Shared Tool Semantics and File Icon

- [x] 3.1 Add a neutral pure tool semantics module for symbols used by 3+ features.
- [x] 3.2 Keep UI-only labels/icons/classes/translation policy in messages toolBlocks.
- [x] 3.3 Unify private/shared `FileIcon` contracts and migrate status-panel callers.

## 4. Verification

- [x] 4.1 Prove relevant external messages-private imports are zero.
- [x] 4.2 Run focused tests, messages/tool suites, typecheck, build, boundary gate, and strict validation.
- [x] 4.3 Record evidence and baseline qualifiers in `verification.md`.
