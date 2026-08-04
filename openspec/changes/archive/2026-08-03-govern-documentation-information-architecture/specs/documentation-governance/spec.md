## ADDED Requirements

### Requirement: 文档必须声明可判定的生命周期
Repository documentation SHALL 使用 `active`、`implemented`、`historical`、`superseded`、`deprecated` 或 `generated` 中可判定的 lifecycle；容易被 direct-open reader 误读的非 active 文档 SHALL 同时声明事实边界与 canonical replacement。

#### Scenario: 直接打开已实施计划
- **WHEN** 读者直接打开已经完成的 implementation plan
- **THEN** 文头明确显示 `implemented` 或 `historical`，并指向当前代码、main spec 或 archived change，而不会把未勾选历史 checkbox 表示为 active backlog

#### Scenario: 打开废弃占位文档
- **WHEN** 读者打开包含 `PLACEHOLDER`、`PENDING` 或空 metric 的废弃 evidence
- **THEN** 文头明确显示 `deprecated`，并说明该文件不得作为 current evidence

### Requirement: 索引必须按职责和事实强度导航
`docs/README.md` SHALL 作为 canonical documentation hub，current 一级分区 SHALL 提供 README；索引 SHALL 区分 current guides/references、historical evidence、generated artifacts 与 deprecated content。

#### Scenario: 从主入口查找当前指南
- **WHEN** 读者从 `docs/README.md` 查找 workflow、development、UI 或 troubleshooting 指南
- **THEN** 读者可经 `guides/` 索引到达维护中的文档，而不需要遍历 analysis、research 或 root stray files

#### Scenario: 索引历史证据
- **WHEN** dated report、plan 或 experiment 被保留
- **THEN** 对应 section README 将其列入 historical/implemented/superseded 分组，而不是 current work queue

### Requirement: Current claim 必须以当前事实源校准
Living documentation MUST 以 current code、`package.json` 和 main OpenSpec specs 为事实源；dated evidence MUST 保留 capture-time version、timestamp 或 commit，且不得被当前校准静默覆盖。

#### Scenario: Current 文档引用旧产品版本
- **WHEN** current guide 仍声明旧产品版本或把 archived change 写成 active
- **THEN** 文档更新为当前代码事实并记录 `last_verified`，同时保留必要的历史说明

#### Scenario: 历史性能报告包含旧数据
- **WHEN** historical performance report 的数值来自旧版本
- **THEN** 数值保持原样，索引和 lifecycle banner 明确它不是 current measurement

### Requirement: 路径迁移必须保护消费者
Documentation relocation SHALL 在同一 change 中更新 repo 内 active references；被 scripts、package commands、source comments 或 immutable archived evidence 高 fan-out 引用的路径 MUST 保持稳定或保留唯一 tombstone。

#### Scenario: Generated artifact 路径被脚本消费
- **WHEN** `package.json` 或 producer/consumer script 直接引用 documentation artifact path
- **THEN** 本轮保持该 path，或原子更新所有 producer、consumer、workflow 与 indexes 后才迁移

#### Scenario: 历史路径被 archived evidence 引用
- **WHEN** immutable archived OpenSpec 引用被迁移文档
- **THEN** 旧路径保留只读 tombstone 或兼容入口，且不存在两份可编辑正文

### Requirement: 历史与废弃内容必须可追溯
Retired content SHALL 保留退役原因、原始职责和 replacement；无长期价值的 duplicate runtime artifacts MAY 删除，但删除动作 MUST 在 archive record 或 index 中留痕。

#### Scenario: 退役 legacy marketing site
- **WHEN** 静态站无部署 owner、引用缺失 assets 且产品叙事已过时
- **THEN** 站点从 current documentation surface 移除，并由 archive record 说明旧路径、退役日期与替代入口

### Requirement: 文档治理必须有可执行门禁
Repository SHALL 提供零额外 dependency 的 documentation check，验证 local links、Markdown reachability、section indexes、archive lifecycle、root allowlist 与 JSON parse integrity，并 SHALL 在 CI 中运行。

#### Scenario: 文档引用不存在的本地目标
- **WHEN** Markdown 或 HTML 新增指向不存在文件的 local link
- **THEN** `npm run check:docs` 以非零状态退出并报告 source 与 target

#### Scenario: 新文档未进入索引
- **WHEN** 新增 Markdown 无法从 `docs/README.md` 到达
- **THEN** `npm run check:docs` 失败并列出 orphan path

#### Scenario: 文档治理健康
- **WHEN** local links、indexes、lifecycle、root allowlist 与 JSON assets 均符合 contract
- **THEN** `npm run check:docs` 成功退出且不修改 repository files
