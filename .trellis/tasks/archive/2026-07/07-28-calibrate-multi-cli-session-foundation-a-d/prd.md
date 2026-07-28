# Change A–D 全链路校准 Review

## OpenSpec

- Change：`calibrate-multi-cli-session-foundation-a-d`
- 基准设计：`docs/research/mossx-multi-cli-provider-session-foundation-design.md`
- 总任务清单：`docs/plans/2026-07-27-multi-cli-provider-session-foundation-task-checklist.md`
- 人工测试计划：`docs/reports/multi-cli-session-foundation-a-d-impact-and-manual-test-plan-2026-07-28.md`
- 新 CLI 指南：`docs/research/mossx-new-cli-onboarding-guide.md`

## Goal

把 Change A–D 的设计、任务、当前代码与测试重新对齐，修复跑偏、遗漏、跨平台、性能与交互问题，
形成可以进入真实 Desktop smoke 的可审计代码基线。

## Requirements

- 建立“设计要求 → task → production code → automated test”能力矩阵。
- 审计 Shared Event Log、Canonical Facts、Projection、Execution Target、Context Delivery、
  Native Provider Continuation 的端到端读写与恢复链。
- 覆盖 macOS、Windows、Linux 的 path、atomic write、lock、CLI spawn、encoding 与权限边界。
- 检查根 hook、polling、streaming dispatch、catalog scan 和大型历史 materialization 性能。
- 检查 Provider Picker、degraded confirmation、recovery、source navigation 与 unsupported 状态。
- 发现根因后最小修复，补 success/failure/edge/cross-platform tests。
- 只跑 Change A–D 相关整体测试，不跑仓库无关全量测试。

## Acceptance Criteria

- [x] A–D 所有 MUST/SHALL 要求都有代码或明确 capability gate。
- [x] 不存在静默 Provider fallback、重复 side effect、来源 history mutation 或假 ACK。
- [x] 三平台使用 platform-safe path/lock/atomic persistence/spawn contract。
- [x] 根渲染链无高频数组追加、秒级轮询或逐 delta reducer dispatch。
- [x] 用户能区分 running、degraded、unsupported、recovery-required 与 source unavailable。
- [x] 新增测试覆盖 Review 发现的所有 High/Critical 根因。
- [x] 相关 Rust/Vitest/typecheck/lint/runtime-contract/OpenSpec checks 通过。
- [x] 管理文档与代码事实同步，剩余真实 Desktop smoke 明确保留为人工 gate。

## Non-Goals

- 不新增 Change E 多 Agent 编排能力。
- 不实现 Kimi target acceptance 或 remote artifact owner，除非 Review 证明现有代码错误宣称支持。
- 不做与 A–D 无关的全仓重构。
- 不用 mock 自动化冒充真实 Provider Desktop smoke。

## Rollback

修复以单个 Conventional Commit 原子收口；不改写已有 A–D 历史，可整体 revert。
