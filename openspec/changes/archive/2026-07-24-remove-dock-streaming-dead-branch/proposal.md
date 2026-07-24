# Proposal: remove-dock-streaming-dead-branch

## Summary

删除 global runtime notice dock 中永不可达的 `streaming` status 死分支：生产 status memo 自 2026-06-05 `c585cc147`（`fix(runtime): 运行时提示仅显示错误消息`）起只产出 `has-error` / `idle`，`resolveGlobalRuntimeNoticeDockStatus` 与 `GLOBAL_RUNTIME_NOTICE_STREAMING_WINDOW_MS` 仅剩测试引用，组件层的 `streaming` label case、minimized indicator 分支与 10 个 locale 的 `statusStreaming` i18n 键均为 dead code。同步以 spec delta 校准 `global-runtime-notice-dock` 主 spec 中仍要求 streaming 高亮语义的两处 requirement。

## Motivation

- `useGlobalRuntimeNoticeDock.ts:535-538` 的生产 status memo 只产 `has-error` | `idle`；`GlobalRuntimeNoticeDock.tsx:128-129` 的 `effectiveStatus` 同样只产 `has-error` | `idle`。`streaming` 在两条链路都永不可达。
- `resolveGlobalRuntimeNoticeDockStatus`（`:423-437`）写好但未接线，仅被 `useGlobalRuntimeNoticeDock.test.tsx` 引用；`GLOBAL_RUNTIME_NOTICE_STREAMING_WINDOW_MS`（`:22`）只被该死函数引用。
- 死分支带来持续维护成本：10 个 locale 的 `statusStreaming` 键、`vitest.setup.ts` mock 翻译、组件 switch case 都要随文案/类型变更同步更新，却永远不会渲染。
- 主 spec `openspec/specs/global-runtime-notice-dock/spec.md:112` 仍写着 “MUST 使用 `streaming` 或 `has-error` 等高亮语义”，与 2026-06-05 起的有意简化（仅 error 展示）漂移，需要 spec delta 校准。

## Scope

- In scope:
  - 删除 `src/features/notifications/hooks/useGlobalRuntimeNoticeDock.ts` 的 `GLOBAL_RUNTIME_NOTICE_STREAMING_WINDOW_MS`、`GlobalRuntimeNoticeDockStatus` 类型中的 `"streaming"` 成员、`resolveGlobalRuntimeNoticeDockStatus` 函数。
  - 删除 `src/features/notifications/components/GlobalRuntimeNoticeDock.tsx` 的 `resolveStatusLabel` streaming case 与 `resolveMinimizedIndicatorState` streaming 分支。
  - 调整两处测试对该死函数 / `status="streaming"` 的引用（最小锚点，保持剩余测试语义）。
  - 删除 10 个 locale 文件与 `src/test/vitest.setup.ts` 中的 `runtimeNotice.statusStreaming` 键。
  - 提供 `global-runtime-notice-dock` spec delta：MODIFIED 两处仍提及 streaming 的 requirement，记录 2026-06-05 `c585cc147` 的有意简化。
- Out of scope（邻近死代码，仅记录不修）：
  - `src/styles/global-runtime-notice-dock.css` 中 `.global-runtime-notice-dock-status.is-streaming` 样式规则（dead CSS）。
  - `MinimizedIndicatorState` 的 `"has-notice"` 成员及 `BellDot` 分支在删除 streaming 分支后不再有生产者（本 change 保留，避免越出既定删除点）。

## Risks

- 低风险：所有删除符号的引用闭包已 grep 验证（仅测试与 i18n/mock 引用）。
- 测试改动仅限删除死函数断言与把 `status="streaming"` 换成合法成员，不改变被测行为语义。

## Verification

- `npm run typecheck`
- `npx eslint` 覆盖全部改动文件
- `npx vitest run` 覆盖 `useGlobalRuntimeNoticeDock.test.tsx` 与 `GlobalRuntimeNoticeDock.test.tsx`
