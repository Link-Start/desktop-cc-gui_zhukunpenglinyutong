# Research 文档索引

本目录保存技术调研、架构分析、运行手册与阶段性 evidence。研究结论和带日期的报告是生成当时的时间快照，不是当前 backlog 或当前代码行为的 single source of truth。

当前事实入口：[`../../README.md`](../../README.md)、[`../../AGENTS.md`](../../AGENTS.md)、[`../../openspec/project.md`](../../openspec/project.md)、[`../../openspec/changes/README.md`](../../openspec/changes/README.md) 与 [`../../openspec/specs/README.md`](../../openspec/specs/README.md)。

## Project Memory 研究链

- [项目记忆功能全景（Phase 1 完成版）](00-project-memory-feature-overview.md)
- [项目记忆功能设计方案](01-project-memory-design.md)
- [MemOS 架构分析](02-memos-architecture-analysis.md)
- [项目记忆模块架构设计图](03-project-memory-architecture.md)
- [项目记忆消费机制研究](04-project-memory-consumption-research.md)

## 开发运行手册

- [桌面开发版快速启动 Runbook](desktop-dev-fast-start-runbook.md)

运行手册执行前仍应核对当前 `package.json`、仓库脚本和平台环境。

## Realtime CPU evidence

- [Baseline Report](realtime-cpu/baseline-report.md)
- [Acceptance Report](realtime-cpu/acceptance-report.md)
- [Rollout and Rollback SOP](realtime-cpu/rollout-rollback-sop.md)

Baseline / acceptance report 只证明对应采样窗口；是否满足当前性能 gate，应以新的 runtime evidence 为准。
