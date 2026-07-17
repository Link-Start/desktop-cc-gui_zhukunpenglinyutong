# 项目文档导航

本目录收录架构说明、实施计划、研究记录、性能证据与专项运行手册。为避免历史材料被误读为当前实现，阅读时先确认文档所属层级：

- 当前产品能力与使用方式：[`../README.md`](../README.md)
- 项目规则、文档分层与全局 gate：[`../AGENTS.md`](../AGENTS.md)
- 当前 OpenSpec 治理总览：[`../openspec/project.md`](../openspec/project.md)
- 当前 active changes：[`../openspec/changes/README.md`](../openspec/changes/README.md)
- 当前 behavior specs：[`../openspec/specs/README.md`](../openspec/specs/README.md)

`plans/`、`research/`、性能历史基线和带日期的 evidence 都是生成当时的时间快照，不等同于当前 backlog，也不能单独证明当前代码行为。发生冲突时，以当前代码、仓库级规则与 OpenSpec 当前索引为准。

## 分区索引

- [架构与治理](architecture/README.md)
- [实施计划](plans/README.md)
- [研究与运行证据](research/README.md)
- [性能文档](perf/README.md)
- [性能历史基线](perf/history/README.md)

## 对话与渲染

- [Chat Canvas Conversation Curtain Contracts](chat-canvas-conversation-curtain-contracts.md)
- [Claude 引擎对话幕布渲染链路](markdown-doc1-claude-chat-canvas-rendering.md)
- [Codex 引擎对话幕布渲染链路](markdown-doc2-codex-chat-canvas-rendering.md)

## Workflow 与运行手册

- [Codex Collaboration Mode Enforcement Runbook](codex-collaboration-mode-enforcement-runbook.md)
- [Curated Skill Onboarding](curated-skill-onboarding.md)
- [OpenSpec + Trellis Team Playbook](openspec-trellis-playbook.md)

## 专项材料

- [v0.7.3 后续执行建议（时间快照）](analysis/client-shortcuts-and-priorities-2026-07.md)
- [Browser Dock Phase 3 跨平台降级能力矩阵](browser-agent/phase3-cross-platform-degraded-capability-matrix.md)
- [Sidebar Cache Implementation Plan（历史计划）](superpowers/plans/2026-04-16-sidebar-cache-implementation.md)
- [Sidebar Cache Design（历史设计）](superpowers/specs/2026-04-16-sidebar-cache-design.md)

## 维护规则

1. 新增子目录文档时，优先更新该子目录索引，再从本页连接索引。
2. 带日期、版本或采样 commit 的文档必须保留其时间边界，不用它覆盖当前事实源。
3. 行为变化进入 `openspec/changes/<change-id>/`；实现约束进入 `.trellis/spec/**`；本目录不承担 active proposal 索引职责。
