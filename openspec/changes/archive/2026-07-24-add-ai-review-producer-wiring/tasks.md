# add-ai-review-producer-wiring — Tasks

- [x] 1. 评估两条调用时机路线(on-demand + per-turn cache vs turn 结束自动生成),在 design.md 写明取舍 — 选 on-demand
- [x] 2. 确认引擎通道先例与 `AutoSessionMetadata.sessionPurpose` 为自由字符串,选定 `engineSendMessageSync` + hidden autoSession(`semantic-diff-review`)
- [x] 3. 实现 `src/features/session-activity/utils/turnSemanticReview.ts`:prompt 构建(diff 截断预算)、`parseTurnSemanticReviewResponse`(共享 parser + 逐 fact 校验)、`requestTurnSemanticReview`(claude 主 + codex 兜底,永不 throw)
- [x] 4. 实现 `src/features/session-activity/hooks/useTurnSemanticReview.ts`:enabled 触发、per-turn cache(含 null)、in-flight 去重、event-driven setState
- [x] 5. 接线 `WorkspaceSessionActivityPanel.tsx` 的 `TurnArtifactsSection`:semantic tab 激活时取 review,到达后重算 semanticSummary
- [x] 6. 新增 `turnSemanticReview.test.ts`:解析/校验/降级用例(10 tests)
- [x] 7. 新增 `useTurnSemanticReview.test.tsx`:生成一次、cache 命中不重复调用、失败静默降级用例(5 tests)
- [x] 8. 扩展 `semanticDiffSummary.test.ts`:AI facts 正确分发到四区
- [x] 9. 验证:focused vitest 24 passed + `WorkspaceSessionActivityPanel.test.tsx` 67 passed 回归 + `tsc --noEmit` 0 error + 改动文件 eslint 0 problem + `openspec validate --strict` 通过
