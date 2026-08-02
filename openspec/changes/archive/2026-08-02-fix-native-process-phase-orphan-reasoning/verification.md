# Verification

## Automated

```bash
pnpm exec vitest run \
  src/features/messages/orchestration/presentation/messagesViewModel.collapseMiddleSteps.test.ts \
  src/features/messages/timeline/projection/messagesTimelineProjection.test.ts
# → 11 + 8 passed

pnpm exec vitest run \
  src/features/messages/components/Messages.live-behavior.test.tsx \
  -t 'collapse|process phase|已处理|middleSteps'
# → 相关用例 passed

openspec validate fix-native-process-phase-orphan-reasoning --strict --no-interactive
# → valid
```

## Manual（建议）

- Native Claude：多工具回合结束后，顶部不应再挂被计划文隔开的孤儿「思考过程」；
  应为 `已处理 · 思考/工具…`，展开可 remount。
- Native Grok：同上。
- Shared Grok/Claude 历史：图3 干净形态不回归。

## Scope Review

- 生产代码仅 `messagesViewModel.ts` 折叠归属 + 类型注释。
- 测试仅 `messagesViewModel.collapseMiddleSteps.test.ts`。
- 无关 working tree（session_management / SessionManagement UI）未纳入本 change。
