# 设计：adapt-subagent-cross-engine-display

> 追溯型设计文档：记录已验收实现的关键决策。

## Context

首版 persona UI（`enhance-subagent-canvas-persona-ui`）的识别层只匹配 Claude `Agent`/`Task` tool 名，详情抽屉只走 `claude:` history loader，会话树 live 投影只覆盖 Claude pending 子代理。结果是其它引擎全线断裂：

- Codex collab（`spawn agent` / `spawn_agent`）→ 幕布仍是 `Collab: spawn` 扁条；官方协议 `message` 为 Fernet 密文，误入卡片/详情。
- Grok `spawn_subagent` → 不识别；`get_command_or_subagent_output` poller 又有误伤风险；子会话 `parent_session_id` 存在于 `subagents/{id}/meta.json` 但 list API 不吐。
- Kimi agent swarm → launch（`items`）与 result（XML `<subagent>`）重复计数 3+3=6。
- Shared Session → 投影 tool 不识别；子会话 parent 指向被隐藏的 native owner 导致树挂空；Claude Agent launch 回执只有裸 agentId，bindings 常为空时无法拼 `claude:subagent:…`。
- 状态：`resolveToolStatus` 在 status 仍为 `started/running` 时优先判 processing，已完成子代理显示假「运行中」、小队 `0/3`。
- i18n：subagentUi 仅 zh/en。

## Goals / Non-Goals

**Goals:**

- 单引擎识别规则全部收敛到 `subagent-ui/utils`（isSubagentTool / subagentViewModel），幕布/StatusPanel/Shared 投影共用。
- 详情抽屉按引擎路由到正确 history loader，失败时回退 output 而非错误内容。
- 会话树父子在 Grok/Codex/Shared 下成立，且不破坏既有 Claude 链路。
- 状态以「完成语义 output + 子会话处理态」为准。
- 8 语言文案 + parity 测试防回归。

**Non-Goals:**

- 不改引擎协议与 runtime 契约（方案 B 否决，见 proposal）。
- 不做历史会话启发式归树；不做无样本引擎（Kimi native/OpenCode/Gemini）的猜测识别。

## Decisions

### D1 识别规则按引擎特征精确匹配，宁窄勿宽

- Collab：title/toolType 归一（`_`→空格）后匹配 `spawn agent`，`wait`/`close` 只作普通工具不成卡；spawn 按 `receiver` 数组展开多卡。
- Grok：仅 `spawn_subagent`/`Spawn Subagent` 及前缀变体；`includes("subagent")` 的宽匹配会误伤 output poller，显式排除。
- Kimi：组内若存在 XML `<subagent>` 结果则跳过纯 `items` 的 launch 卡，`dedupeSubagentSquadCards` 兜底，杜绝 3+3。
- 密文过滤：`gAAAAA…`（Fernet）永不作为 description/交付报告；描述优先 `task_name`/子会话昵称。

### D2 详情 sessionThreadId 三级解析

1. card 自带合法引擎前缀 id（`claude:`/`grok:`/`kimi:`/`shared:` 等）直接用。
2. Shared 裸 agentId → 用 `activeNativeThreadIds` 的 `claude:owner` 拼 `claude:subagent:{owner}:{agentId}`。
3. bindings 缺失 → 从 launch `output_file` 路径（`.../{parent}/tasks/{agentId}.output`）兜底解析。
解析不到且有 launch 特征 → 友好提示文案；普通失败 → 回退 output 展示。

### D3 Shared 父子 remap 而非改绑定

子会话 list 元数据的 parent 指向 hidden native owner。UI 层建 `nativeThreadId → sharedThreadId` 映射，merge 与 live 投影时把子会话改挂 `shared:` 父；`setThreads` 同步写 `threadParentById`。不动 `bindingsByEngine` 持久化（属 Shared 绑定域）。

### D4 Shared 父幕布缺 tool 时合成小队卡

Shared 投影常只有 assistant 正文。`activeCanvas` 暴露 `childSubagentThreads`，仅当当前幕布是 `shared:` 父且无 subagent tool 时，用子线程合成 `spawn_subagent` tool item 走同一套 SquadGrid；嵌套详情幕布（`grok:` 等）不注入，CSS 兜底隐藏。

### D5 状态判定 output 优先于 status 字符串

`mapToolStatus` 检测完成语义 output（问候正文/completed/duration_ms 等）直接判完成；`enrichSubagentCardStatuses` 再结合子会话 `isProcessing` 与助手正文纠正；合成 tool 用子线程真实状态。

### D6 i18n 手工补齐 + parity 门禁

8 个 locale 新增 `subagentUi.ts` 并注册 index（位置对齐 en）；删除 6 个零引用死键；`subagentUiLocaleParity.test.ts` 递归比对键集合与 `{{placeholder}}`，防后续漏译。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 引擎 tool 名再出变种（如新版 collab 改名） | 识别集中单点，parity/单测锁定现有规则；新变种按本变更模式增量补 |
| Shared bindings 长期为空导致只靠路径兜底 | 提示文案引导；绑定持久化修复留给 Shared 域变更 |
| 合成卡与真实 tool 并存时重复 | 仅在「无 subagent tool」时合成；dedupe 兜底 |
| 状态误判（长任务正文碰巧含 completed 字样） | 完成语义匹配限定结构化特征，不只关键词 |
| 追溯变更与已归档/进行中 change 的 spec 重叠 | delta 仅描述新增行为；archive 时与 enhance-subagent-canvas-persona-ui 合并校验 |
