## 1. OpenSpec

- [x] 1.1 [P0] 写 proposal / design / delta specs（含跨引擎矩阵）
- [x] 1.2 [P0] `openspec validate fix-shared-sidebar-hide-set-staleness --strict --no-interactive`

## 2. Frontend hide set 新鲜度

- [x] 2.1 [P0] 异步 Grok refresh：重建 hide set（fresh ∪ outer）+ `requestSeq` 再校验
- [x] 2.2 [P0] 异步 Kimi refresh：同构修复
- [x] 2.3 [P1] 异步 Gemini refresh：防御性同构修复
- [x] 2.4 [P0] 主路径 `setThreads` 前 `stripHiddenSharedBindingSummaries`

## 3. Merge baseline purge

- [x] 3.1 [P0] `stripHiddenSharedBindingSummaries` helper
- [x] 3.2 [P0] `mergeNativeCliSessionSummaries` 双向 strip；禁止 empty sessions early-return 原 base
- [x] 3.3 [P0] mergeGrok/Kimi/Gemini 透传 hide set

## 4. 验证

- [x] 4.1 [P0] helpers unit：strip + merge empty sessions purge
- [x] 4.2 [P0] shared-native-compat：async race materialize hide + main strip
- [x] 4.3 [P0] focused Vitest 通过（36 tests）
- [ ] 4.4 [P1] 手测 Shared × Grok 首轮发送侧栏仅 shared 行
- [ ] 4.5 [P2] 手测 Shared × Kimi / Claude / Codex 无回归（可选）

## 5. 跨引擎审查（文档）

- [x] 5.1 [P0] design 中记录 Claude/Codex/OpenCode 无同类异步 stale 洞的结论
- [x] 5.2 [P0] 标明 Grok/Kimi 同构洞与 Gemini 防御性修复范围
