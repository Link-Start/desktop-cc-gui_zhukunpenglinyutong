# message-codeblock-filechange-rendering Specification

## Purpose
TBD - created by archiving change retro-message-codeblock-and-filechange-rendering. Update Purpose after archive.
## Requirements
### Requirement: Code blocks MUST expose language and copy affordances consistently

Markdown code blocks 和 file-preview code blocks SHALL 以一致方式暴露 language indication 与 copy action。

#### Scenario: 已知语言代码块

- **WHEN** 已知语言代码块
- **THEN** 当 code block 有 recognized language 时，UI 必须显示语言 affordance，并保持 copy action 可达且不遮挡正文。

### Requirement: File change evidence MUST render as compact per-file rows

消息和工具面 SHALL 将 file changes 渲染为 compact per-file rows，并保留 path、action、status 可读性。当多个文件属于同一幕布「文件修改场景」时，系统 MAY 先以场景级折叠摘要承载列表；用户展开后 MUST 仍以 per-file row 展示每个文件。

#### Scenario: 多个文件变更

- **WHEN** 多个文件变更
- **THEN** 当 tool result 包含多个 changed files 时，每个文件必须作为独立 row 展示，用户可以快速扫描路径和变更状态。

#### Scenario: 场景折叠下的多文件可读性

- **WHEN** 多个 changed files 被场景折叠容器承载且用户展开该场景
- **THEN** 每个文件 MUST 仍作为独立 row 展示 path 与变更状态
- **AND** 折叠态 MUST 通过场景文案中的文件数量提示存在多文件变更

