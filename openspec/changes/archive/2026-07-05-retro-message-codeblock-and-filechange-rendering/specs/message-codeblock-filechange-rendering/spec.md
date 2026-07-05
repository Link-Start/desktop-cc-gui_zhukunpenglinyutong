# Spec Delta: message-codeblock-filechange-rendering

## ADDED Requirements

### Requirement: Code blocks MUST expose language and copy affordances consistently

Markdown code blocks 和 file-preview code blocks SHALL 以一致方式暴露 language indication 与 copy action。

#### Scenario: 已知语言代码块

- **WHEN** 已知语言代码块
- **THEN** 当 code block 有 recognized language 时，UI 必须显示语言 affordance，并保持 copy action 可达且不遮挡正文。

### Requirement: File change evidence MUST render as compact per-file rows

消息和工具面 SHALL 将 file changes 渲染为 compact per-file rows，并保留 path、action、status 可读性。

#### Scenario: 多个文件变更

- **WHEN** 多个文件变更
- **THEN** 当 tool result 包含多个 changed files 时，每个文件必须作为独立 row 展示，用户可以快速扫描路径和变更状态。
