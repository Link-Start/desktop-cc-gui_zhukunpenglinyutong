# Design

## #6 skill invocation 契约

### 类型与链路

```ts
// src/types/conversation.ts
export type SkillInvocation = {
  name: string;                    // slash token 归一化后的名字（无 `/` 前缀）
  args?: Record<string, string>;   // 预留：本批恒为空/缺省
};
```

- `MessageSendOptions.skillInvocations?: SkillInvocation[]`
- `useThreadMessaging.SendMessageOptions` 同步加字段，发送点透传 `options?.skillInvocations ?? null`。
- `appServer.engineSendMessage` params + invoke payload 加 `skillInvocations`（snake_case `skill_invocations` 到 Rust）。
- Rust `engine_send_message`：`skill_invocations: Option<Vec<SkillInvocation>>`（serde struct），接收后 `log::debug!` 记录，不消费。daemon RPC 不透传（契约边界 = Tauri command；daemon/引擎消费后续立项）。

### Assembler

`promptAssembler` 新增：

```ts
export function assembleSkillInvocations(input: {
  skills: { name: string }[];
  commons: { name: string }[];
}): SkillInvocation[]
```

- 名字归一化复用 `toSlashToken` 的去 `/`、空白转 `-` 规则（去前缀后）。
- Composer 发送处：`shouldAssemblePrompt` 为真时同时计算 invocations 放进 sendOptions；为假（用户手敲 `/` 开头）时不下发。
- 文本拼接保持逐字不变。

## #9 对话沉淀

### Rust `claude_command_create`

```
claude_command_create(workspace_id: String, name: String, content: String) -> ClaudeCommandEntry
```

- 名称校验：trim、非空、`[a-z0-9][a-z0-9-_]*`（lowercase 归一），拒绝路径分隔符与 `..`。
- 目标：`workspace_commands_dir(state, entry)`（managed 层），`create_dir_all` 后写 `<name>.md`；已存在 → 报错（不静默覆盖）。
- 返回 `ClaudeCommandEntry { name, path, source: workspace_managed, description: None, argument_hint: None, content }`。
- 批次 2 watcher 监听该目录 → emit `claude-commands-changed` → 前端自动刷新。

### 前端 feature `src/features/prompt-distill/`

- `utils/distillInstruction.ts`：`buildDistillInstruction(sourceText, locale)`（zh/en，同 enhancer 结构），要求输出**仅**命令模板正文、插入 `$ARGUMENTS` 参数位。
- `hooks/usePromptDistillation.ts`：状态机 `idle → distilling → preview → saving`；`start(sourceText)` → `engineSendMessageSync`（hidden autoSession `sessionPurpose: "prompt-distill"`、`accessMode: "read-only"`、60s timeout、claude→codex retryable fallback 复用 `classifyPromptEnhancerError`）；`save(name, content)` → `claudeCommandCreate`；错误走 `resolveDistillFailureCopy`（本地化，复用 enhancer 的 kind 语义）。
- `components/PromptDistillDialog.tsx`：名称输入 + 内容 textarea + `$ARGUMENTS` 提示 + 保存/取消；distilling 显示 loading，错误内联展示。

### 菜单接线

- `useConversationNoteCaptureMenu` options 加 `onSaveAsPrompt?: (sourceText: string) => void`；selection 与整 thread 各加一项 `promptDistill.saveAsPrompt`。
- `useMessagesInteractions` / `MessagesCore` 透传；MessagesCore 内实例化 `usePromptDistillation`（已有 `workspaceId`）并渲染 dialog（紧邻 noteCaptureMenu 渲染处）。

### i18n

新模块 `promptDistill.ts` ×10 locale + 各 `index.ts` 注册：`menuSaveAsPrompt` / `dialogTitle` / `nameLabel` / `namePlaceholder` / `contentLabel` / `argumentsHint` / `distilling` / `save` / `cancel` / `failedTimeout` / `failedGeneric` / `failedEmpty` / `savedTitle` / `savedMessage` / `nameInvalid`。

## 测试

- promptAssembler：invocations 归一化（去 `/`、空白转 `-`、空名过滤）、文本不变回归。
- useThreadMessaging/appServer：payload 透传单测（按现有 mock 模式）。
- Rust：`claude_command_create` 成功写入、重名拒绝、非法名拒绝。
- usePromptDistillation：distill 成功→preview、fallback、失败文案、save 调用参数。
- 菜单：onSaveAsPrompt 存在时菜单项出现并回传 selection 文本。

## 验收修正（2026-07-26）

1. **语义命名**：客户端 `/` = 命令、`!` = 提示词。沉淀产物写入 managed
   commands 目录，全部用户可见文案定为「生成命令」语义（×10 locale），
   对话框固定展示功能说明（保存位置 + `/` 调用方式）。
2. **managed 命令执行链路**：managed 目录是 mossx 私有注册表
   （`workspace_context`），引擎只解析项目/全局 `.claude` 等目录
   （`engine_injected`）。因此发送前在 Composer 对开头的
   `/<managed 命令> [args]` 做客户端展开（`expandLeadingManagedCommand`）：
   正文含 `$ARGUMENTS` 全量替换，无占位符时参数追加；引擎可见或未知命令
   原样透传（保持引擎原生解析与 Unknown command 报错行为）。
