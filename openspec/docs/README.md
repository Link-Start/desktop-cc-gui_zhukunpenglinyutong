# OpenSpec Governance / Evidence 文档索引

本目录保存跨 change 的治理说明、研究记录、人工测试矩阵与阶段性审计证据。它们的事实有效期不同，不能把历史报告中的版本号、数量或完成状态直接当作当前项目状态。

## 当前事实源

- 项目现状与文档边界：[`openspec/project.md`](../project.md)
- 已同步 mainline behavior truth：[Main Specs](../specs/README.md)
- 当前待办与 active delta：[Active Changes](../changes/README.md)
- 历史 change lifecycle：[Archived Changes](../changes/archive/README.md)

## Durable governance / reference

以下文档用于长期约束或命名映射；若它与 main spec、active change 或当前代码冲突，以当前代码及上述事实源为准。

- [Spec Namespace Governance](./spec-namespace-governance.md) — 约束 `spec-hub-*` canonical namespace 与 `spec-platform-*` compatibility namespace。

## Dated evidence / audit snapshots

以下 **24** 个 artifact 都是特定日期、版本、分支或验收窗口下的快照。它们适合追溯当时的判断与证据，不是当前数量、实现状态或 release readiness 的事实源。

- [Archive Delta Sync Report — 2026-02-27](./archive-delta-sync-report-2026-02-27.md)
- [Codex Plan 模式对齐差距分析 — 2026-03-02](./codex-plan-gap-analysis.md)
- [Code Alignment Report — 2026-03-20](./code-alignment-report-2026-03-20.md)
- [Spec Sync Report — 2026-03-20](./spec-sync-report-2026-03-20.md)
- [Spec Sync Validation — 2026-03-20 (JSON)](./spec-sync-validation-2026-03-20.json)
- [v0.3.12 Change Analysis — 2026-04-12](./v0.3.12-change-analysis-2026-04-12.md)
- [v0.3.8–v0.3.12 Change Analysis — 2026-04-12](./v0.3.8-v0.3.12-change-analysis-2026-04-12.md)
- [Claude Mode Rollout 非文件审批 Bridge 评估 — 2026-04-17](./claude-mode-rollout-non-file-approval-bridge-evaluation-2026-04-17.md)
- [Claude Mode Rollout V.4 手测矩阵 — 2026-04-17](./claude-mode-rollout-v4-manual-test-matrix-2026-04-17.md)
- [Computer Use Activation Bridge 手测矩阵 — 2026-04-23](./computer-use-activation-bridge-manual-test-matrix-2026-04-23.md)
- [Computer Use Bridge 手测矩阵 — 2026-04-23](./computer-use-bridge-manual-test-matrix-2026-04-23.md)
- [Computer Use Helper Host Contract 手测矩阵 — 2026-04-23](./computer-use-helper-host-contract-manual-test-matrix-2026-04-23.md)
- [Computer Use Official Parent Handoff 手测矩阵 — 2026-04-23](./computer-use-official-parent-handoff-manual-test-matrix-2026-04-23.md)
- [Client Stability + Conversation Implementation Readiness — 2026-05-11](./client-stability-conversation-implementation-readiness-2026-05-11.md)
- [Client Stability Manual Test Matrix — 2026-05-12](./client-stability-manual-test-matrix-2026-05-12.md)
- [Phase 1 Release Closure — 2026-05-14](./phase1-release-closure-2026-05-14.md)
- [Harness Governance Closure Report — 2026-05-20](./harness-governance-closure-report-2026-05-20.md)
- [Proposal Refresh Audit — 2026-05-23 / 2026-05-24](./proposal-refresh-2026-05-23.md)
- [Runtime Evidence Gate Governance Report — 2026-05-24](./runtime-evidence-gates-2026-05-24.md)
- [Session Management Refactor Closeout — 2026-05-24](./session-management-refactor-closeout-2026-05-24.md)
- [Project Map / Understand-Anything Design Study — 2026-06-02](./project-map-understand-anything-design-study-2026-06-02.md)
- [P0 Performance Workspace Reconciliation — 2026-06-10](./p0-performance-workspace-reconciliation-2026-06-10.md)
- [Lazy State-Extension Regression Note — 2026-06-11](./lazy-state-extension-regression-2026-06-11.md)
- [Weekly Code Change OpenSpec Audit — 2026-07-15](./weekly-code-change-openspec-audit-2026-07-15.md)

> 历史报告中的 active/archive/spec 数量、路径和 gate 结论都必须回到当前索引重新核验；日期较新不等于优先级更高。
