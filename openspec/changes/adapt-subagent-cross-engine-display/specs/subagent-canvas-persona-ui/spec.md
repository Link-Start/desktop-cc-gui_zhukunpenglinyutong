# subagent-canvas-persona-ui Specification (delta)

## Purpose

在 persona 卡片/小队网格/inspector 抽屉基础上，把识别与详情解析从 Claude 扩展到 Codex Collab、Grok、Kimi 与 Shared Session，并补齐状态纠正与八语言 i18n。

## ADDED Requirements

### Requirement: Cross-engine subagent tool recognition

系统 MUST 将以下引擎的 subAgent 工具识别为 persona 卡片来源：Codex collab spawn（含 `spawn agent` 与 `spawn_agent` 归一）、Grok `spawn_subagent`/`Spawn Subagent`、Kimi agent swarm；Shared Session 投影工具 MUST 走同一识别。

#### Scenario: codex collab spawn underscore variant

- **WHEN** 幕布出现标题为 `Collab: spawn_agent`（下划线变体）的工具
- **THEN** 系统 MUST 按 collab spawn 识别并渲染 persona 卡（按 receiver 展开多卡）

#### Scenario: codex wait and close stay plain

- **WHEN** 幕布出现 `wait_agent` / `close_agent` / `wait agent` / `close agent` 工具
- **THEN** 系统 MUST NOT 将其渲染为 persona 卡

#### Scenario: grok output poller excluded

- **WHEN** 幕布出现 `get_command_or_subagent_output` 类轮询工具
- **THEN** 系统 MUST NOT 将其识别为 subAgent 卡

#### Scenario: kimi items and xml deduped

- **WHEN** Kimi swarm 的 launch（`items` 占位）与 result（XML `<subagent>`）同时存在
- **THEN** 小队 MUST 只渲染一组卡（3 子代理渲染 3 张，而非 6 张）

### Requirement: Encrypted collab payload never surfaces

系统 MUST NOT 把 collab `message` 中的密文（如 `gAAAAA…` Fernet 串）用卡片描述或详情交付报告；描述 MUST 优先取 `task_name`/子会话昵称。

#### Scenario: encrypted message in spawn args

- **WHEN** collab spawn 参数 `message` 为密文
- **THEN** 卡片描述 MUST 回退到 `task_name` 或子会话名
- **AND** 详情 MUST NOT 展示密文原文

### Requirement: Cross-engine inspector session resolution

打开 inspector 时系统 MUST 按引擎路由到正确的 history loader；Shared 下裸 agentId MUST 先经 native owner 拼接，bindings 缺失时 MUST 从 launch `output_file` 路径兜底解析 `claude:subagent:{parent}:{agentId}`。

#### Scenario: shared claude launch ack with output file

- **WHEN** Shared 会话的 Claude Agent launch 回执含 `output_file: .../{parent}/tasks/{agentId}.output` 且 bindings 为空
- **THEN** 详情 MUST 能解析并加载 `claude:subagent:{parent}:{agentId}` transcript

#### Scenario: unresolvable session falls back gracefully

- **WHEN** sessionThreadId 无法解析且 output 为 launch 元数据
- **THEN** 详情 MUST 显示友好提示文案
- **AND** MUST NOT 把 launch 元数据当交付报告展示

### Requirement: Synthetic squad from shared child sessions

当 Shared 父幕布无 subAgent tool 但存在子代理子会话时，系统 MUST 用子会话合成小队卡；嵌套详情幕布 MUST NOT 再次注入合成卡。

#### Scenario: shared parent without spawn tools

- **WHEN** Shared 父会话投影只有 assistant 正文且存在 3 个子代理子会话
- **THEN** 幕布 MUST 渲染 3 张 persona 卡
- **AND** 打开某卡详情时，详情内 MUST NOT 嵌套同一小队

### Requirement: Truthful card status

卡片状态 MUST 以完成语义 output 与子会话处理态综合判定，MUST NOT 在子代理已完成时显示「运行中」或 `0/3`。

#### Scenario: completed output overrides started status

- **WHEN** tool status 仍为 `started/running` 但 output 具备完成语义（正文/completed/duration 等）
- **THEN** 卡片 MUST 显示已完成与满进度条

### Requirement: subagentUi eight-language bundles

系统 MUST 为 zh-TW、ja、ko、es、fr、ru、hi、pt-BR 提供 subagentUi 文案并注册到各自 locale index；MUST 有 parity 测试锁定键集合与插值占位符一致；零引用死键 MUST 移除。

#### Scenario: switch to Japanese

- **WHEN** 界面语言切到 ja
- **THEN** 卡片/抽屉/状态文案 MUST 显示日语而非回退英文

#### Scenario: locale parity guard

- **WHEN** 运行 locale parity 测试
- **THEN** 全部 10 个 locale 的 subagentUi 键集合与 `{{placeholder}}` MUST 与 en 一致
