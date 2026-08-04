# subagent-canvas-persona-ui Specification

## Purpose

定义对话幕布 subAgent 的 persona 卡片 / 小队网格呈现、静态作者池映射、幕布内 inspector 抽屉，以及 StatusPanel 子代理列表与幕布共享打开路径的行为契约。

## Requirements

### Requirement: Static persona pool without runtime git

系统 MUST 使用编译期静态作者池为 subAgent 分配显示名；MUST NOT 在 persona 分配路径上调用 git log、shortlog 或等价 IPC。

#### Scenario: stable name for same agent id

- **WHEN** 同一 `agentId` 在同一会话内被多次渲染
- **THEN** 显示名 MUST 保持一致

#### Scenario: insufficient distinct authors

- **WHEN** 并行 subAgent 数量大于池内作者数
- **THEN** 系统 MUST 循环复用池内名字（允许重名）
- **AND** MUST NOT 抛错或回退到空名

#### Scenario: no git invocation

- **WHEN** 打开含 subAgent 的会话或打开 inspector
- **THEN** persona 分配 MUST NOT 触发 git log / shortlog 请求

### Requirement: Canvas single card presentation

系统 MUST 将识别为 subAgent 的单个 `Agent`/`Task` tool 渲染为 persona 卡片（名字、头像、任务描述、status/进度、工具数可选），而不是仅显示工具名扁条。

#### Scenario: lone agent tool

- **WHEN** 幕布上出现单个 subAgent tool item
- **THEN** UI MUST 显示 persona 单卡
- **AND** 头像 MUST 使用 `AgentIcon` 并以显示名为 seed（或等价稳定 seed）

### Requirement: Canvas squad grid for consecutive subagents

系统 MUST 将时间线上连续的 subAgent tool items 合并为一支小队网格展示。

#### Scenario: consecutive agents form a squad

- **WHEN** 连续两个及以上 subAgent tool 相邻（中间无其它 tool 打断）
- **THEN** 系统 MUST 渲染小队网格
- **AND** 每张卡 MUST 含序号、显示名、任务摘要、进度与可选工具数

#### Scenario: non-subagent tool breaks the squad

- **WHEN** 两个 subAgent tool 之间插入非 subAgent tool
- **THEN** 系统 MUST NOT 将它们合并为同一小队
- **AND** 各自按单卡或后续连续段成组

### Requirement: Canvas-local inspector drawer

点击 subAgent 卡片 MUST 在对话幕布区域内打开临时 inspector 抽屉；MUST NOT 占用全局 right panel tab。

#### Scenario: open drawer from card

- **WHEN** 用户点击一张 subAgent 卡片
- **THEN** 幕布内 MUST 出现 inspector 抽屉
- **AND** 抽屉 MUST 展示任务描述、status、工具数（可知时）、output/交付报告（无则安全占位）

#### Scenario: close drawer

- **WHEN** 用户点击关闭或按 Esc（实现支持时）
- **THEN** 抽屉 MUST 关闭
- **AND** 对话主列 MUST 恢复可用宽度

#### Scenario: does not use global right tab

- **WHEN** inspector 打开
- **THEN** 系统 MUST NOT 因此新建或切换全局 right panel 的文件/设置类 tab 作为承载

### Requirement: Progress bar semantics

进度条 MUST 反映 subAgent 真实结束态，禁止在 running 时固定满条。

#### Scenario: completed fills bar

- **WHEN** subAgent status 为 completed
- **THEN** 进度条 MUST 为满条
- **AND** 工具数可知时 MUST 展示

#### Scenario: running is not full

- **WHEN** subAgent status 为 running
- **THEN** 进度条 MUST NOT 显示为 100% 完成

### Requirement: Status panel opens the same inspector

右下角子代理列表 MUST 始终可点击，并打开与幕布相同的 inspector 路径。

#### Scenario: list row without navigation target

- **GIVEN** 某 subAgent 缺少 thread/claude-task `navigationTarget`
- **WHEN** 用户点击该列表行
- **THEN** 系统 MUST 仍打开 canvas inspector（或等价共享 inspect 回调）
- **AND** MUST NOT 因缺少 navigationTarget 而禁用点击

#### Scenario: list and canvas share selection

- **WHEN** 用户从 StatusPanel 打开某 agent 详情
- **THEN** inspector 展示的 agent 身份 MUST 与该列表项一致

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
