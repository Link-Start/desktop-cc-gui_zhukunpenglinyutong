## 任务清单

### 1. skill invocation 契约

- [x] 1.1 [P0][Depends: none][Input: types/conversation + promptAssembler][Output: `SkillInvocation` 类型、`MessageSendOptions.skillInvocations`、`assembleSkillInvocations` 导出][Verify: assembler 单测（归一化 + 文本不变）]
- [x] 1.2 [P0][Depends: 1.1][Input: Composer / useThreadMessaging / appServer][Output: sendOptions → engineSendMessage payload 全链路透传][Verify: 透传单测]
- [x] 1.3 [P0][Depends: 1.1][Input: `src-tauri/src/engine/commands.rs`][Output: `engine_send_message` 接受可选 `skill_invocations`（接收+debug 日志，不消费）][Verify: cargo test 通过]

### 2. 对话沉淀 Rust 侧

- [x] 2.1 [P0][Depends: none][Input: `src-tauri/src/claude_commands.rs`][Output: `claude_command_create`（managed 目录写入、重名/非法名拒绝）+ command_registry 注册 + 前端 wrapper][Verify: cargo 单测 3 条]

### 3. 对话沉淀前端

- [x] 3.1 [P0][Depends: 2.1][Input: 新 feature prompt-distill][Output: distillInstruction + usePromptDistillation + PromptDistillDialog][Verify: hook 单测（成功/fallback/失败/save）]
- [x] 3.2 [P0][Depends: 3.1][Input: 菜单链][Output: useConversationNoteCaptureMenu / useMessagesInteractions / MessagesCore 接线 + dialog 渲染][Verify: 菜单单测]
- [x] 3.3 [P1][Depends: 3.1][Input: i18n][Output: `promptDistill` 模块 ×10 locale + 注册][Verify: locale parity 通过]

### 4. 跨层验证与交付

- [x] 4.1 [P0][Depends: 1.3, 3.3][Input: 全部改动][Output: typecheck / lint / Vitest / cargo test 全绿][Verify: 各 gate 命令]
- [x] 4.2 [P1][Depends: 4.1][Input: OpenSpec artifacts][Output: tasks 勾选 + changes/README 更新][Verify: openspec validate --strict]

### 5. Review-Discovered Closure

- [x] 5.1 [P1][Depends: review][Input: review 发现项][Output: 修复或记录 waiver][Verify: 二次 review 通过]
- [x] 5.2 [P0][Depends: review][Input: 人工验收反馈][Output: `expandLeadingManagedCommand`：managed 命令发送前客户端展开（$ARGUMENTS 替换/追加），引擎可见命令不受影响][Verify: assembler 单测 6 条]
