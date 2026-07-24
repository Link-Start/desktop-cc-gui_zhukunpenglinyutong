# add-ai-review-producer-wiring

## Why

已归档 change `2026-06-10-deepen-semantic-diff-review` 沉淀了完整的 AI review 契约与消费链路:`TurnSemanticReview` schema(`src/features/git/utils/semanticDiffSummary.ts:50-61`)、消费端 `addAiReviewFacts`(:778,按 category 分发进 intent/behavior/risk/validation 四区,无 evidenceRefs 的 fact 丢弃)、四区混排渲染 + AI 徽章 + 证据可点击跳转 UI 均已就绪。但**生产者从未接线**:唯一生产调用点 `WorkspaceSessionActivityPanel.tsx` 的 `buildTurnArtifactSummary` 调 `buildSemanticDiffSummary` 时不传 `aiReview`,AI explain layer 目前是死路径。本 change 补上生产者,让 AI review 作为 explain layer 真正可用。

设计红线(继承自已归档 design):AI review 只能作 explain layer,每条结论必须引用 evidence refs,不得覆盖/隐藏规则事实;解析失败静默降级为无 AI facts,不报错、不打断 UI。

## What Changed

- 新增 turn 级 AI review 生产者:用户点开 turn 的 `语义 diff` tab 时按需生成,按 turn 缓存,同一 turn 不重复调用(含失败结果)。
- 引擎通道复用现有轻量先例:`engineSendMessageSync` + hidden `autoSession`(`sessionPurpose: "semantic-diff-review"`,与 `prompt-enhancer` / `commit-message` / `project-map` 同一模式),不新造引擎管线、不新增后端 command。
- 生成契约:输入该 turn 的文件改动摘要(path + status + 截断 diff),要求模型输出严格 JSON;复用共享 `parseModelStructuredJsonObject` 解析 + 逐 fact 校验(category/confidence 合法、text 非空、evidence path 必须属于本 turn 文件集)。任一校验失败的 fact 丢弃;整体解析失败返回 `null`,UI 静默降级为纯规则事实。
- 成本与兜底:module 级 per-turn cache(含失败/null 结果),claude 主通道失败时静默回退 codex,双通道均失败则缓存 null,不再重试。

## Scope

### In Scope

- `src/features/session-activity/utils/turnSemanticReview.ts`(新增):prompt 构建、模型输出解析校验、引擎调用(永不 throw)。
- `src/features/session-activity/hooks/useTurnSemanticReview.ts`(新增):按需触发 + per-turn cache + React state 接线。
- `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`:`TurnArtifactsSection` 内接线(semantic tab 激活时触发,review 到达后重算 semanticSummary)。
- 测试:utils 解析/降级测试、hook 缓存/降级测试、`semanticDiffSummary.test.ts` 四区分发测试。

### Out Of Scope

- 新增后端 command、持久化 schema 或设置项。
- turn 结束自动生成(评估后放弃,理由见 design.md)。
- 修改 `buildSemanticDiffSummary` 规则抽取逻辑与 `addAiReviewFacts` 消费逻辑。
- AI review 的手动重试/刷新 UI。

## Impact

- Affected frontend: 上述四个 `src/features/session-activity/**` 文件 + `src/features/git/utils/semanticDiffSummary.test.ts`(仅追加测试)。
- Backend impact: none(复用现有 `engine_send_message_sync`)。
- Runtime contract impact: 新增一个 hidden autoSession `sessionPurpose` 取值 `"semantic-diff-review"`,与 `prompt-enhancer`/`commit-message` 同类,无 schema 变更。

## Validation Plan

- `npx vitest run src/features/session-activity/utils/turnSemanticReview.test.ts src/features/session-activity/hooks/useTurnSemanticReview.test.tsx src/features/git/utils/semanticDiffSummary.test.ts src/features/session-activity/components/WorkspaceSessionActivityPanel.test.tsx`
- `npm run typecheck`
- 对改动文件跑 `npx eslint`
- `openspec validate add-ai-review-producer-wiring --strict --no-interactive`
