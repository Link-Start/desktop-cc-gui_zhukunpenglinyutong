# Performance Documents

本目录保存 performance contract、诊断 runbook、阶段性计划与生成的 evidence artifact。入口先看 [`../README.md`](../README.md) 的事实边界：

- 当前实现事实以代码、manifest、OpenSpec main specs 和重新运行的 measurement 为准。
- 带版本号、日期、commit 或 branch 的 baseline / report 是当时快照，不自动代表当前 `HEAD`。
- `history/` 是只读历史锚点，完整索引见 [`history/README.md`](history/README.md)。

## 当前导航

- [Runtime Evidence Gates](runtime-evidence-gates.md) — runtime evidence 的采集与 gate contract
- [Budget Decision Table](budget-decision-table.md) — performance budget 与判定口径
- [Parallel Conversation Jank Index](parallel-conversation-jank-index.md) — 并行会话卡顿材料入口
- [Parallel Conversation Jank Handbook](parallel-conversation-jank-handbook.md) — 复现、测量与诊断手册
- [Render Jank Knife Experiments (2026-07-08)](render-jank-knife-experiments-2026-07-08.md) — 有日期的实验记录；其中数值不是永久基线
- [A4 Live Text Externalization Plan](a4-live-text-externalization-plan.md) — 方案与阶段性验证计划

## 阶段性快照

以下文档按文件内 version、timestamp、commit 与验收窗口解读：

- [Jank Fix Progress](jank-fix-progress.md)
- [v0.5.8 Performance Optimization Roadmap](v0.5.8-performance-optimization-roadmap.md)
- [v0.5.10 Performance Closure](v0.5.10-performance-closure.md)
- [v0.5.14 Curated Skill Baseline](v0.5.14-curated-skill-baseline.md)
- [v0.5.14 Evidence Acceptance](v0.5.14-evidence-acceptance.md)
- [v0.5.14 UX Jank Acceptance](v0.5.14-ux-jank-acceptance.md)

## Baseline Artifact 角色

- [`baseline.md`](baseline.md) / `baseline.json` 是最后一次生成的 aggregate snapshot：v0.5.11、branch `feature/v0.5.11`、commit `9a2c9f4a18656549c009c4bc8199f1770327ce3b`，生成于 2026-06-18。它们**不是**当前 0.7.5 `HEAD` 的测量结果。
- `history/v<version>-baseline*.{md,json}` 是带版本或 timestamp 的历史锚点。
- 根目录 `*-baseline.json` fragment 是 producer output，由 `scripts/perf-aggregate.mjs` 聚合；读取前必须核对 artifact 内 metadata。

## Schema

由 `scripts/perf-aggregate.mjs` 生成的 aggregate / fragment artifact 使用 `schemaVersion: "1.0"`；consumer 必须先检查 major version。常见 metric 字段包括：

- `scenario`：稳定场景 id，例如 `S-LL-200`、`S-CS-COLD`
- `metric`：OpenSpec design 定义的稳定 metric 名
- `value`：数值；当前平台不支持时为 `null`
- `unit`：metric unit
- `notes`：可选上下文
- `unsupportedReason`：`value` 为 `null` 时必填

[`v0.5.14-baseline.json`](v0.5.14-baseline.json) 不是上述 aggregate schema：它的 `source` 明确为 `TEMPORARY-EMPTY-PLACEHOLDER`，metric 值尚未回填，不能作为当前 performance evidence。

## 历史来源

初始 runtime baseline change 已归档：

- [proposal](../../openspec/changes/archive/2026-05-15-add-runtime-perf-baseline/proposal.md)
- [design](../../openspec/changes/archive/2026-05-15-add-runtime-perf-baseline/design.md)
- [verification](../../openspec/changes/archive/2026-05-15-add-runtime-perf-baseline/verification.md)

新 optimization proposal 引用历史 baseline 时，必须同时写明 version、timestamp/commit、scenario/metric row 与可接受的 regression/improvement bound；若结论用于当前分支 gate，应先重新采样。
