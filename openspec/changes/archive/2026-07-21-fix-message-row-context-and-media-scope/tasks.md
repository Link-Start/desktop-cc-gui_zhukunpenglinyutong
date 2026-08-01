## 1. Regression Contracts

- [x] 1.1 Add browser attachment-only memo regression.
- [x] 1.2 Add intent-canvas attachment-only memo regression.
- [x] 1.3 Add workspace-scoped deferred image stale completion regression.
- [x] 1.4 Add same-scope request generation regression.

## 2. Implementation

- [x] 2.1 Update `areMessageItemsEqual` with explicit attachment equality.
- [x] 2.2 Add workspace/thread/message/locator request identity and stale guards.
- [x] 2.3 Revoke stale and unmounted transient object URLs.
- [x] 2.4 Publish current deferred-image scope only after React commit.

## 3. Verification

- [x] 3.1 Run focused correctness suites, messages suite, typecheck, and lint.
- [x] 3.2 Record implementation evidence and validate this change strictly.
