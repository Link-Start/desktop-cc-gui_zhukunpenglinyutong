# Proposal: add-skill-invocation-contract-and-prompt-distill

## Why

`docs/reports/composer-prompt-stack-optimization-impact-2026-07-25.md` 批次 4（增量能力）：

- **#6 技能调用纯文本拼接**：`promptAssembler.assembleSinglePrompt` 把选中 skill 拼成 `/skill-name` 裸文本前缀，AI 只能猜参数归属，客户端无法校验，协议没有结构化通道。
- **#9 对话→prompt 沉淀缺失**：对话中的好指令无法一键沉淀为可复用的自定义命令；可行性已被 enhancer 隐藏 session 通道验证。

## What Changes

### #6 skill invocation 结构化契约（最小协议层版）

- 新增 `SkillInvocation { name, args? }` 类型；`MessageSendOptions` / `useThreadMessaging.SendMessageOptions` / `engineSendMessage` IPC payload 全链路新增可选 `skillInvocations`。
- `promptAssembler` 新增 `assembleSkillInvocations` 导出；Composer 发送时把选中 skills/commons 的结构化形式随消息下发，**文本拼接行为保持不变**（降级展示）。
- Rust `engine_send_message` 接受可选 `skill_invocations` 参数并记录 debug 日志；引擎侧解析与参数校验属后续协议演进，不在本提案。

### #9 对话沉淀为自定义命令

- 对话上下文菜单（selection / 整 thread）新增"存为 Prompt"入口。
- 提炼链路：源文本 → 隐藏 session（`sessionPurpose: prompt-distill`，read-only，claude→codex retryable fallback）AI 提炼为带 `$ARGUMENTS` 参数位的命令模板 → 可编辑预览（名称 + 内容）→ 保存。
- Rust 新增 `claude_command_create`：写入 workspace managed commands 目录（list 聚合优先级最高、批次 2 watcher 已监听），保存后 `/` 补全自动可见。
- 新增 `promptDistill` i18n 模块（10 locale）。

## 目标与边界

- #6 只落地契约通道：类型、全链路可选字段、Rust 边界接收；发送文本与 UI 完全不变。
- #9 入口复用 note-capture 上下文菜单模式；保存目标固定为 workspace managed 层。

## 非目标

- 引擎侧解析 `skillInvocations` / 参数 schema 校验 / 带表单的技能调用面板（协议演进后续立项）。
- 存为 Skill（curated/项目 skill 目录写入、frontmatter 完整编辑）；本批只做自定义命令（prompt）沉淀。
- 提炼结果的流式渲染。

## 方案取舍

- #6 选"最小协议层"而非完整双端协议：报告明示完整版协议成本最高，先落地结构化通道与降级文本共存，引擎消费后续接入。
- #9 保存到 workspace managed 目录而非项目 `.claude/commands`：managed 层由本应用全权管理、不污染用户项目目录，且 watcher/list 已覆盖。
- 提炼引擎策略复用 enhancer 的 claude→codex retryable fallback，不引入新的引擎选择 UI。

## Capabilities

- `composer-skill-invocation-contract`（新增）
- `conversation-prompt-distill`（新增）

## Impact

- 前端：types/conversation、promptAssembler、Composer、useThreadMessaging、appServer、messages 菜单链（useConversationNoteCaptureMenu / useMessagesInteractions / MessagesCore）、新 feature `prompt-distill`、10 locale。
- Rust：engine/commands.rs（可选参数）、claude_commands.rs（create 命令）、command_registry.rs。
- 行为：发送文本不变；新增菜单入口与对话框。

## 验收标准

- 选中 skill 发送时 IPC payload 携带结构化 `skillInvocations`，文本与现状逐字一致。
- 上下文菜单"存为 Prompt"→ 提炼预览 → 保存后，`claude_commands_list` 立即可见且 watcher 触发前端刷新。
- 提炼失败有本地化错误展示；`$ARGUMENTS` 参数位在预览中保留。
