# subagent-canvas-persona-ui Specification

## Purpose

定义对话幕布 subAgent 的 persona 卡片 / 小队网格呈现、静态作者池映射、幕布内 inspector 抽屉，以及 StatusPanel 子代理列表与幕布共享打开路径的行为契约。

## ADDED Requirements

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
