## Why

`docs/**` 同时承载 current guide、architecture reference、historical plan、generated evidence 与 deprecated placeholder，但生命周期和事实源没有统一表达，导致已归档工作仍像 active backlog、旧版本快照仍可能被误读为当前行为。当前产品已到 `0.7.16`，需要在不破坏脚本路径契约和历史证据的前提下完成一次可持续的文档治理闭环。

## 目标与边界

- 建立统一 documentation lifecycle、目录职责、metadata 与索引规则。
- 依据当前代码和 OpenSpec 状态校准仍声明 current 的文档。
- 对 historical、superseded、deprecated、generated 内容做明确分层或标记。
- 保持被 `package.json`、scripts 与 source comments 消费的路径稳定，迁移时同步引用或保留单一 tombstone。
- 增加可执行的本地 link、index、lifecycle 与 JSON integrity gate。

## 非目标

- 不重写 immutable historical evidence，使旧结论伪装成当前测量。
- 不刷新 accepted performance 或 large-file ratchet baseline 来消除告警。
- 不重新设计产品官网，不改变应用运行行为。
- 不联网刷新 Obsidian、Pi、MemOS 等第三方研究快照。

## What Changes

- 新增 `docs/GOVERNANCE.md`，定义 `active / implemented / historical / superseded / deprecated / generated` 生命周期及事实源规则。
- 保留已有 `analysis / architecture / perf / plans / research / reports` 主分区，新增 `guides / reference / archive` 入口，减少 root stray documents。
- 将仍具维护价值的 runbook、onboarding、UI guide 与 conversation contract 校准至 `0.7.16` 并重新归类。
- 将已完成 plans、incident/review、旧 rendering 文档、Browser Agent matrix、Superpowers artifacts 与 performance placeholders 标记或归档。
- 退役无部署 owner、存在断图且叙事过时的 legacy marketing site，保留退役记录。
- 修复 repo 内文档链接、OpenSpec archive pointers 与 source-code documentation pointers。
- 新增零依赖 `scripts/check-docs.mjs`、`npm run check:docs` 与 CI gate。
- 保持 machine-bound generated paths；只刷新 safe advisory watchlist，不修改 accepted baselines。

## 方案对比与取舍

### 方案 A：只补索引与状态标记

改动最小、路径零迁移，但 root stray files、旧站点和 current/historical 混层仍长期存在，无法形成清晰的信息架构。

### 方案 B：整棵 `docs/**` 全量重排

目录最整齐，但会破坏 scripts、source comments、archived OpenSpec 与外部书签中的高 fan-out 路径，迁移成本和回归风险过高。

### 采用方案：生命周期优先的混合治理

保留成熟主分区和 machine-bound paths；物理迁移低引用、低风险内容；高引用历史正文原地增加 lifecycle/canonical pointer 或保留 tombstone。该方案以最小路径破坏获得可执行治理能力。

## Capabilities

### New Capabilities

- `documentation-governance`: 规定 repository documentation 的目录职责、生命周期、事实源、索引可达性、归档语义及自动校验要求。

### Modified Capabilities

- 无。

## 验收标准

- `docs/README.md` 能导航全部维护中 Markdown；current 一级分区均有 README。
- repo 内 Markdown/HTML local links 无断链；JSON 文档资产均可解析。
- Current 索引不再将 archived changes、historical plans 或 `TEMPORARY / PLACEHOLDER / PENDING` evidence 视为当前事实。
- Deprecated/archived 文档包含 lifecycle、原因与 canonical replacement；历史正文不被静默改写。
- `npm run check:docs` 可本地执行并接入 CI。
- `openspec validate --change govern-documentation-information-architecture --strict` 通过。

## Impact

- 文档：`docs/**`、root `README.md` 中的 documentation pointers。
- Workflow artifacts：新增 OpenSpec change 与关联 Trellis task。
- Tooling：`scripts/check-docs.mjs`、`package.json`、`.github/workflows/ci.yml`、必要的 branding/path checks。
- Source comments：仅更新被迁移文档的 pointer，不改变 TypeScript/Rust runtime behavior。
- Dependencies：不新增第三方依赖，使用 Node.js standard library。
