# Tasks: project-shared-canonical-conversation

## 1. Rust Projection Module

- [x] 1.1 Create `src-tauri/src/shared_projection/` module structure and public API surface
- [x] 1.2 Implement `ProjectionItem` / `ProjectionCheckpoint` / `MismatchReport` types
- [x] 1.3 Implement `SharedProjector::project_events` for `turnRequested` / `turnCommitted` / `usageRecorded` / `controlFact`
- [x] 1.4 Implement `SharedProjector::rebuild` with full event log scan
- [x] 1.5 Implement checkpoint read/upsert/invalidate in `SharedEventWriter`
- [x] 1.6 Unit tests for projector mapping rules

## 2. Legacy Dual-Read

- [x] 2.1 Implement `LegacySharedReader` for V0 snapshot files
- [x] 2.2 Map legacy snapshot to `ConversationItem` with `fidelity = "presentation-only"`
- [x] 2.3 Unit tests for legacy reader (missing fields, corrupted file, read-only guarantee)

## 3. Shadow Comparator

- [x] 3.1 Implement `ShadowComparator` with mismatch classification
- [x] 3.2 Unit tests for comparator (match, shadow-only, legacy-only, content-mismatch)

## 4. Writer API Extension

- [x] 4.1 Add `read_projection_events(session_id)` to `SharedEventWriter`
- [x] 4.2 Add `upsert_projection_checkpoint` / `get_projection_checkpoint` to `SharedEventWriter`
- [x] 4.3 Integration tests for checkpoint round-trip

## 5. Frontend Shared DataSource

- [x] 5.1 Create `src/features/messages/presentation/sharedProjection/types.ts`
- [x] 5.2 Create `src/features/messages/presentation/sharedProjection/dataSource.ts`
- [x] 5.3 Wire Shared DataSource into Messages/Canvas behind feature flag
- [x] 5.4 Frontend unit tests for Shared DataSource isolation

## 6. Canvas Regression Gate

- [x] 6.1 Add Native golden fixtures regression test
- [x] 6.2 Add Shared projection rebuild determinism test
- [x] 6.3 Add Shared target switch no-remount test
- [x] 6.4 Add background binding no-render-storm test

## 7. Gate 3 Verification

- [x] 7.1 Run targeted A2/A3 Rust tests（按本轮“不跑全量测试”约束）
- [x] 7.2 Run targeted Shared Projection / Canvas frontend tests
- [x] 7.3 Run `openspec validate project-shared-canonical-conversation --strict --no-interactive`
- [x] 7.4 Update master task checklist Wave 3 status
- [x] 7.5 Commit and record Trellis session
