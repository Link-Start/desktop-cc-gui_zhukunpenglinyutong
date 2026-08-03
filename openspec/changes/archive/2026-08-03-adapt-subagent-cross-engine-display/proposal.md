# 提案：adapt-subagent-cross-engine-display

> 追溯型变更：实现已完成并经用户验收（native/shared 各引擎 smoke 通过），本变更补齐 OpenSpec 契约文档。

## Why

`enhance-subagent-canvas-persona-ui` 只打通了 Claude `Agent`/`Task` 一条链路。实际使用中 Codex Collab、Grok `spawn_subagent`、Kimi agent swarm 以及 Shared Session 投影下的子代理在幕布仍是扁条/不识别，会话树无父子层级，详情抽屉解析失败或显示启动回执原文，subagentUi 文案也只有中英两种语言。属于跨引擎严重缺失，需要按已验收的实现补齐契约。

## 目标与边界

- 幕布识别扩展到全引擎：
  - Codex collab `spawn agent`/`spawn_agent`（含 `wait`/`close` 排除、按 receiver 展开多卡、密文 `message` 过滤）。
  - Grok `spawn_subagent`/`Spawn Subagent`（排除 `get_command_or_subagent_output` poller；从 output 解析 `subagent_id`）。
  - Kimi agent swarm（`items` 占位与 XML `<subagent>` 结果互斥去重；launch/result 拆条时组内去重）。
  - Shared Session 投影 tool 同样识别；Shared 父幕布缺 tool 时按子会话合成小队卡。
- 会话树父子层级：
  - Grok `list_grok_sessions` 扫描 `subagents/` 输出 `parentSessionId`/`sessionKind`。
  - Codex 已有 `parent_thread_id` 自动补齐。
  - Shared 场景将子会话从隐藏的 native owner 改挂到 `shared:` 父会话。
  - `setThreads` 同步 `threadParentById`；merge 时旧线程也补 parent。
- 详情抽屉跨引擎加载：
  - `SubagentSessionCanvas` 按引擎选择 loader（claude/codex/grok/kimi/shared）。
  - Claude 启动回执从 `output_file` 路径兜底解析 `claude:subagent:{parent}:{agentId}`。
  - launch 元数据/密文不再当成交付报告展示；加载失败回退 output。
- 状态纠正：completion 语义 output + 子会话 `isProcessing` 综合判定，避免假「运行中」与 `0/3`。
- i18n：subagentUi 补齐 zh-TW/ja/ko/es/fr/ru/hi/pt-BR，删除零引用死键，新增 locale parity 测试。

## 非目标

- 不改 subAgent 启动/调度/权限契约，不改 collab 协议本身。
- 不做历史平铺会话的启发式事后归树（仅 live 投影与 list 元数据）。
- 不做 Kimi/OpenCode/Gemini 尚无本地样本的新 tool 形态猜测。
- 不改 Shared Session 绑定持久化（`bindingsByEngine` 写入属另一域）。
- 不重构 persona 池（沿用 enhance-subagent-canvas-persona-ui 的静态池与权重）。

## What Changes

- `subagent-ui/utils`：跨引擎识别（collab 下划线变种归一、swarm items/XML 互斥、spawn 精确匹配）、密文过滤、`output_file` 路径解析、状态纠正、合成卡 ViewModel。
- `SubagentSessionCanvas` / `SubagentInspectorDrawer`：跨引擎 loader 选择、Shared 裸 agentId 运行时解析、launch 回执过滤。
- `activeCanvasStore` / threads hooks：子会话投影、`childSubagentThreads`、`threadParentById` 同步、native→shared parent remap。
- `src-tauri`：`list_grok_sessions` 输出 `parent_session_id`/`session_kind`。
- `StatusPanel` 子代理列表：单行 persona 列表，主点击只开抽屉。
- i18n：8 个 locale 新增 `subagentUi.ts` 并注册；新增 `subagentUiLocaleParity.test.ts`；删除死键。

## Capabilities

- **New Capabilities**: 无。
- **Modified Capabilities**:
  - `subagent-canvas-persona-ui` — 识别范围从 Claude 扩展到 Codex/Grok/Kimi/Shared；新增合成卡、状态纠正、跨引擎详情解析、八语言 i18n。
  - `subagent-session-tree-navigation` — 父子层级扩展到 Grok/Codex/Shared（含 native owner remap）。
  - `generic-tool-presentation` — collab/swarm/spawn 工具的分组与去重规则。

## 技术方案比较

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **A. 识别层逐引擎适配 + 投影合成兜底** | 在 isSubagentTool/ViewModel 按引擎特征识别；Shared 缺 tool 时由子会话合成 | 不碰引擎协议；Shared 无 tool 也可渲染；与 Claude 链路复用同一卡片 | 识别规则需随引擎变种维护 | **采用**（已验收） |
| **B. 要求各引擎统一吐 subAgent 结构化事件** | 改 runtime 契约让引擎输出统一 subagent 事件 | 一劳永逸、识别最干净 | 跨 Rust/多 CLI 大改，周期长；历史会话仍无数据 | 否决（本轮范围外） |

## 验收标准

- Native Codex（含 DeepSeek 提供方）collab spawn 在幕布渲染为小队卡；`wait/close` 不成卡；密文不出现在卡片/详情。
- Native/Shared Grok：`spawn_subagent` 成卡；poller 工具保持扁条；会话树父会话下可见子代理层级。
- Kimi swarm：3 个子代理渲染为 3 张卡（不出现 3+3=6）。
- Shared Claude Agent：点卡片详情为子会话 transcript；binding 缺失时经 `output_file` 路径兜底；无 session 时显示友好提示而非 launch 原文。
- 已完成子代理卡片状态为「已完成」满条（不出现假运行中与 0/3）。
- 切到 ja/ko 等 8 种语言，卡片/抽屉文案为本语言；parity 测试通过。
- focused Vitest（subagent-ui、groupToolItems、sharedSessionSummaries、isSubagentTool、locale parity）与 `npm run typecheck` 通过。

## Impact

- 前端：`src/features/subagent-ui/**`、`src/features/messages/**`（grouping/render/projection）、`src/features/layout/hooks/activeCanvasStore.ts`、`src/features/threads/hooks/*`、`src/features/status-panel/**`、`src/features/shared-session/runtime/sharedSessionSummaries.ts`、`src/i18n/locales/*`。
- 后端：`src-tauri/src/engine/grok_history.rs`（session list 元数据）。
- 测试：subagent-ui suite、groupToolItems、sharedSessionSummaries、isSubagentTool、subagentUiLocaleParity。
