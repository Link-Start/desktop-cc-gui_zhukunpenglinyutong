## 1. Freeze behavior
- [x] 1.1 Run all Markdown/runtime tests and external caller smoke tests.
- [x] 1.2 Add direct tests for extracted resources、heavy islands and streaming hook where missing.

## 2. Promote owner
- [x] 2.1 Move Markdown and support modules/tests to `src/markdown/**`.
- [x] 2.2 Keep messages compatibility re-exports and preserve lazy imports.
- [x] 2.3 Split resource normalization、heavy predicates and streaming scheduler.

## 3. Migrate callers
- [x] 3.1 Update messages and every external feature to canonical Markdown paths.
- [x] 3.2 Prove external messages-private Markdown imports and shared->messages imports are zero.

## 4. Verify
- [x] 4.1 Run focused/shared/messages suites、typecheck、lint、build、worker、bundle、boundary gates.
- [x] 4.2 Record line counts、review evidence and baseline qualifiers.
