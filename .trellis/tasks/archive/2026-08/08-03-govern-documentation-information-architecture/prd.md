# Govern Documentation Information Architecture

## Goal

基于 mossx `0.7.16` 当前代码完成 `docs/**` 生命周期治理、内容校准、低风险归档、索引重构与自动门禁，关联 OpenSpec change `govern-documentation-information-architecture`。

## Requirements

- 建立 documentation lifecycle、metadata、事实源、目录职责和归档规则。
- 保留既有六大主分区，新增 `guides / reference / archive` 导航面。
- 更新仍声明 current 的文档；历史证据只补状态和 canonical pointer。
- 将全部 implementation plans 分类为 implemented、superseded 或 cancelled。
- 退役破损 legacy marketing site 和 Finder runtime artifacts。
- 保持 scripts/package 消费的 generated artifact paths。
- 新增零依赖 `npm run check:docs` 并接入 CI。
- 修复 repo 内 local links、OpenSpec pointers 与 source comments。

## Acceptance Criteria

- [x] `docs/README.md` 与 section indexes 能按生命周期导航维护中内容。
- [x] Current 文档对齐 `0.7.16` code/OpenSpec 状态。
- [x] Historical/deprecated/generated 文档无法被误读为 current truth。
- [x] Markdown/HTML local links 无断链，Markdown 从 hub 可达，JSON 可解析。
- [x] Machine-bound paths 与 accepted baselines 未被破坏或刷新。
- [x] `npm run check:docs`、focused advisory 与 strict OpenSpec validation 通过；既有 branding failure 已在 verification evidence 记录为 out-of-scope。

## Definition of Done

- OpenSpec tasks 与实现一致。
- Trellis task context 已配置并完成。
- 改动文件、影响范围、验证结果与残余风险可审计。
- 不执行 git commit；由用户决定提交时机。

## Technical Approach

采用 lifecycle-first hybrid governance：低引用、低风险内容物理迁移；高 fan-out 内容原地校准或保留唯一 tombstone；machine-bound generated artifacts 保持路径。使用 Node.js standard library 实现 documentation gate，不引入 dependency。

## Decision (ADR-lite)

**Context**：全量重排会破坏 scripts、source comments 和 archived OpenSpec；只补索引又无法消除 root stray 与旧站债务。

**Decision**：保留成熟主分区，新增三个导航分区，结合 lifecycle metadata、低风险迁移和自动 gate。

**Consequences**：目录不会一次性达到理论最纯结构，但路径风险可控，后续文档漂移可由 gate 阻断。

## Out of Scope

- 产品 runtime 行为变更。
- 第三方研究的联网再验证。
- Accepted performance/large-file baseline refresh。
- 新 documentation site generator。

## Technical Notes

- Canonical change: `openspec/changes/archive/2026-08-03-govern-documentation-information-architecture/`
- Product version source: `package.json`
- Documentation rules: `AGENTS.md`、`.trellis/spec/guides/project-instruction-layering-guide.md`
- Validation: `npm run check:docs`、`npm run check:branding`、large-file advisory、strict OpenSpec validation
