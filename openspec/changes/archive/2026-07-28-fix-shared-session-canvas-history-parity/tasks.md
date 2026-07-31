## 1. Realtime Target Identity

- [x] 1.1 [P0, depends: none] 在 Shared owner routing boundary 将 `activeTurnTarget` 注入 normalized assistant item；输入为 Shared mapping + frozen snapshot，输出为携带 `executionTargetSnapshot` 的 realtime `ConversationItem`；用 focused routing test 验证。
- [x] 1.2 [P0, depends: 1.1] 统一 local/default Execution Target freeze normalization；输入为无 `providerProfileId` 的新 Turn，输出为明确 disk/local snapshot；用 target store/turn badge focused tests 验证。

## 2. History Convergence

- [x] 2.1 [P0, depends: none] 从现有 Native `conversationAssembler` 暴露最小 history item merge 入口；输入为 base state 与 overlay items，输出为 deduped `ConversationItem[]`；用 mixed-id assistant/reasoning focused tests 验证。
- [x] 2.2 [P0, depends: 2.1] 将 Shared history loader 改为 Legacy transcript base + canonical identity overlay；输入为两种 Shared storage projection，输出为保序且不丢 reasoning 的 snapshot；用 loader focused tests 验证。

## 3. Verification

- [x] 3.1 [P0, depends: 1.1, 1.2, 2.2] 增加 Shared realtime/history parity regression tests，覆盖 Badge、reasoning、dedupe 与 unknown legacy boundary。
- [x] 3.2 [P0, depends: 3.1] 只运行 touched frontend focused Vitest、TypeScript typecheck、changed-file lint 与 strict change validation，并记录结果。
- [x] 3.3 [P1, depends: 3.2] 执行 cross-layer/reuse/performance audit，确认无 Native history access、无 root subscription、无 persistence migration。
