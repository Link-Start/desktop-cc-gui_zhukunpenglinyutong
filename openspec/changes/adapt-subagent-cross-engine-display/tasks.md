# Tasks：adapt-subagent-cross-engine-display

> 追溯型 tasks：实现已完成并经用户 smoke 验收，按实际交付勾选；人工复验项保持未勾并注明。

## 1. 跨引擎识别（subagent-ui/utils）

- [x] 1.1 Codex collab：`spawn agent`/`spawn_agent` 归一识别；wait/close 排除；按 receiver 展开多卡
- [x] 1.2 Grok：`spawn_subagent`/`Spawn Subagent` 精确识别；排除 output poller；output 解析 `subagent_id`
- [x] 1.3 Kimi：swarm items 占位与 XML 结果互斥；组内 launch/result 去重（修 3+3=6）
- [x] 1.4 Shared 投影 tool 强制归类（spawn / SubAgent 描述 title）
- [x] 1.5 密文（`gAAAAA…`）过滤；描述优先 `task_name`/子会话昵称

## 2. 会话树父子层级

- [x] 2.1 Rust `list_grok_sessions` 扫描 `subagents/` 输出 `parentSessionId`/`sessionKind`
- [x] 2.2 merge 补 parent：旧线程较新时仍写 `parentThreadId`
- [x] 2.3 `setThreads` 同步 `threadParentById`
- [x] 2.4 Shared：native owner → `shared:` 父 remap（merge + live 投影）
- [x] 2.5 Codex `parent_thread_id` 自动补链

## 3. 详情抽屉跨引擎解析

- [x] 3.1 `SubagentSessionCanvas` 按引擎选择 history loader（claude/codex/grok/kimi/shared）
- [x] 3.2 Shared 裸 agentId 经 `activeNativeThreadIds` 拼 `claude:subagent:…`
- [x] 3.3 bindings 缺失时从 `output_file` 路径兜底解析 parent
- [x] 3.4 launch 元数据/密文不再当交付报告；失败回退 output
- [x] 3.5 Shared 父幕布缺 tool 时由 `childSubagentThreads` 合成小队卡；嵌套详情不注入

## 4. 状态纠正

- [x] 4.1 完成语义 output 覆盖 started/running 状态
- [x] 4.2 `enrichSubagentCardStatuses` 结合子会话 isProcessing/助手正文
- [x] 4.3 合成 tool 使用子线程真实状态（修 0/3 假运行中）

## 5. i18n 补齐

- [x] 5.1 zh-TW/ja/ko/es/fr/ru/hi/pt-BR 新增 `subagentUi.ts` 并注册 index
- [x] 5.2 删除零引用死键（claudeLaunchLoadHint/emptyOutput/unknown/fields.description/status/toolCount）
- [x] 5.3 新增 `subagentUiLocaleParity.test.ts`（键集合 + 占位符递归比对）

## 6. Verify

- [x] 6.1 focused Vitest：subagent-ui suite（38）、groupToolItems、sharedSessionSummaries、isSubagentTool、locale parity（19）全绿
- [x] 6.2 `npm run typecheck` 0 error（含修复 subagentCardStatus.test.ts TS2783）
- [x] 6.3 人工 smoke 验收：native/shared Claude/Codex/Grok/Kimi 幕布卡片、父子树、详情抽屉（用户已确认通过）
- [ ] 6.4 人工复验（可选）：切 ja/ko 检查窄卡片文案换行（留给用户）
