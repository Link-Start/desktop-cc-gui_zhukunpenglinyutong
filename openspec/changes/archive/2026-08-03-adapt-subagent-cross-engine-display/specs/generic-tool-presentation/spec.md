# generic-tool-presentation Specification (delta)

## Purpose

规定 collab / swarm / spawn 类工具在通用工具渲染与 grouping 层的归类与去重规则，保证 subAgent 卡与普通工具扁条互不串扰。

## ADDED Requirements

### Requirement: Collab lifecycle tool classification

系统 MUST 把 collab 工具按动作分类：spawn（含 `spawn agent`/`spawn_agent` 归一）进入 subAgent 分组；wait/close/输入转发等 MUST 保持普通工具渲染。

#### Scenario: underscore and space variants unified

- **WHEN** toolType 或标题使用下划线（`spawn_agent`）或空格（`spawn Agent`）变体
- **THEN** 分类结果 MUST 一致

### Requirement: Subagent group dedupe

同一小队分组内 MUST 对 launch 占位与 result 展开去重；同一逻辑子代理 MUST NOT 出现两张卡。

#### Scenario: kimi launch plus result in one group

- **WHEN** 分组内同时存在 `items` 占位卡与 XML 结果卡
- **THEN** 渲染 MUST 仅保留一组（优先结构化结果）

### Requirement: Subagent tools survive process-phase collapse

subAgent tool MUST NOT 被回合结束后的 process-phase 折叠吞没；卡片在回合完成后 MUST 仍留在幕布。

#### Scenario: final assistant message after parallel agents

- **WHEN** 并行 subAgent 完成后出现最终 assistant 正文
- **THEN** 小队卡片 MUST 仍可见（仅 reasoning/普通工具被折叠）
