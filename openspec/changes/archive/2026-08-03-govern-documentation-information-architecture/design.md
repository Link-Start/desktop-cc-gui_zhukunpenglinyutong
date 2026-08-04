## Context

当前 `docs/**` 已有 `analysis / architecture / perf / plans / research / reports` 六个主分区和较完整索引，但 root stray documents、legacy marketing site、historical plan、current guide 与 generated evidence 混层。审计发现 current 文档仍引用 `0.7.14` 与已归档 changes；旧站存在断图；performance 与 large-file artifacts 又被 `package.json` 和 scripts 直接消费，不能按普通 Markdown 任意移动。

本变更的 stakeholders 是维护者、AI coding agents、reviewers 与依赖 checked-in evidence 的 CI/scripts。当前产品事实以 `package.json`、运行代码和 main OpenSpec specs 为准；dated document 只证明 capture time 的状态。

## Goals / Non-Goals

**Goals:**

- 用统一 lifecycle 与 metadata 消除 current、historical、generated、deprecated 语义混淆。
- 保留成熟主分区，增加 `guides / reference / archive`，让读者按任务与事实强度导航。
- 校准 living documents，保留 historical evidence 的原始语义。
- 用零依赖 validator 防止断链、孤儿文档、无标记 archive 和 root stray files 回归。
- 对 machine-bound paths、source comments 和 archived OpenSpec references 做安全迁移。

**Non-Goals:**

- 不建立新的 documentation site generator 或引入 Markdown dependency。
- 不把所有历史文件强制移动到单一 archive dump。
- 不用当前代码覆盖 dated external research 或 performance measurements。
- 不修改应用 runtime behavior。

## Decisions

### Decision 1：生命周期优先，目录作为导航而非事实强度的唯一信号

每份维护中或容易误读的文档必须通过 metadata/banner 表达 `type`、`status`、`last_verified`、`canonical_source` 或 `superseded_by`。目录仍用于主题导航，但不能仅凭文件位于 `analysis/` 或 `plans/` 推断其 currentness。

替代方案是只靠目录表达状态。该方案会迫使高 fan-out 文件迁移，并让 direct-open reader 缺少事实边界，因此不采用。

### Decision 2：采用保守 IA 扩展，不重建已有六大分区

保留 `analysis / architecture / perf / plans / research / reports`，新增：

- `guides/`：可执行 runbook、onboarding、troubleshooting、UI guidance。
- `reference/`：由当前代码支撑的 durable contracts 与结构说明。
- `archive/`：低引用的 retired site、historical mirrors 与明确废弃内容。

替代方案是全量重排。由于 archived OpenSpec、scripts 和 source comments 对旧路径有硬引用，收益不足以覆盖断链风险。

### Decision 3：历史正文不可静默追新

Historical、implemented plan、incident、review 与 captured evidence 只增加 lifecycle banner、canonical pointer 和必要的校准附录。旧 checkbox、版本与测量值保留为 capture-time evidence；不得改成当前结果。

### Decision 4：machine-bound artifacts 原路径稳定

被 producers/consumers 绑定的 `docs/perf/**` 与 `docs/architecture/large-file-*` 保持原路径。索引将它们逻辑归类为 generated/history；只有迁移全部 producer、consumer、workflow 和 comments 时才允许物理移动。

### Decision 5：自动门禁使用 Node.js standard library

`scripts/check-docs.mjs` 执行以下检查：

- Markdown/HTML local link existence。
- 从 `docs/README.md` 到 Markdown 的 reachability。
- Current top-level sections 的 README。
- Archive/deprecated 文档 lifecycle marker。
- Root file allowlist。
- JSON parse integrity。

不引入 remark/markdownlint/lychee，避免为有限规则增加 dependency 与配置面。

### Decision 6：低风险迁移直接更新引用，高风险迁移保留 tombstone

Root stray guides/reference 与无 runtime dependency 的 retired artifacts 可物理迁移并同步 repo references。对 source code、producer 或 archived evidence 高 fan-out 的路径，正文原地校准或在旧路径保留只读 tombstone，禁止保留两份可编辑真相。

## Risks / Trade-offs

- [Risk] Validator 的 Markdown parser 不是完整 CommonMark parser。→ 只验证明确的 inline links/HTML attributes，并用 repo fixtures 覆盖边界；不承担 external URL availability。
- [Risk] 历史文档仍留在主题目录，目录视觉上不完全纯净。→ 根和分区索引按 lifecycle 分组，direct-open banner 阻止误读；后续迁移必须按 fan-out 独立立项。
- [Risk] 批量移动导致 archived OpenSpec 断链。→ 在迁移前扫描全 repo references；高引用路径保留 tombstone。
- [Risk] 刷新 generated baseline 可能改变 accepted debt。→ 本轮只允许 advisory watchlist 重扫；ratchet baseline 保持不变。
- [Risk] `openspec/project.md` 的旧产品版本诱发机械替换。→ 产品版本以 `package.json` 为准；本轮不顺带重写 OpenSpec legacy audit history。

## Migration Plan

1. 创建 governance policy、section README 与 lifecycle taxonomy。
2. 校准 living docs 的版本、代码路径、active/archive change 状态。
3. 归档或标记 completed plans、incidents、reviews、placeholders 和 legacy site。
4. 更新 root/section indexes、source comments、OpenSpec pointers 与 branding allowlists。
5. 新增 `check-docs` validator、package script 与 CI gate。
6. 重扫 safe advisory watchlist；不刷新 accepted baseline。
7. 运行 focused documentation/OpenSpec gates，并修复所有失败。

Rollback：按迁移清单反向移动；移除新增 index/policy/gate；恢复旧 pointers。由于不修改 runtime data 或 accepted baselines，无数据迁移与产品回滚要求。

## Open Questions

无。外部研究 freshness 与全量 machine-bound artifact relocation 留给独立变更。
