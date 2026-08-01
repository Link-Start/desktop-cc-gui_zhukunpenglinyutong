# Decompose GenericToolBlock presentation

## OpenSpec

- Change: `openspec/changes/decompose-generic-tool-presentation`
- Roadmap: Phase 8.1-8.3

## 目标

- 将 `GenericToolBlock` 的 pure parser/projection 提取为 `genericToolPresentation.ts`。
- 将 ExitPlan、file-change、image-view variant JSX/actions 移到 focused components。
- common shell、expand/copy、heavy hydration 与 dispatch owner 保持不变。

## 验收

- public props、DOM/a11y、copy/execution/diff/image fallback 行为无漂移。
- pure builder 无 React/i18n/component dependency，并有直接单测。
- focused/messages suites、typecheck、lint、build、boundary 与 strict validation 通过。
