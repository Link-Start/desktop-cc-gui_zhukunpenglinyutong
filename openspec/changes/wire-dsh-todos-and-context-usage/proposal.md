# Proposal: wire-dsh-todos-and-context-usage

> OpenSpec change id: `wire-dsh-todos-and-context-usage`  
> 现场：DSH Web 任务条 / 上下文环与 mossx Composer 对不上  
> 前置：`fix-todo-write-file-change-misclassify`（公共 live 误分类）  
> 上游：`add-dsh-engine`（L2 Native 已能对话，但投影只接了 `tokenUsage` + `sessionStats`）

---

## Why

DSH Web 的任务条和上下文环读 host 投影，不扫工具行：

| Web 读的 key | 含义 | mossx 现状 |
|---|---|---|
| `todos` | 最新 `todo/write` 整表；下一个 `turn/start` 清空 | mux / history 丢掉 |
| `contextPressure` | `projectedTokens` / `pressureTokens` + `contextWindow` | 丢掉；占用环没有窗口总量 |
| `contextBreakdown` | heuristic `systemTokens` / `toolsTokens` / `messageTokens` | 丢掉 |
| `tokenUsage` | 全日志计费桶 | 已接，但只是累计 input/output，不是占用 |
| `sessionStats` | TTFT / tok/s | 已接，底栏速度条 |

所以会出现：Web 已是「1 已完成 · 1 进行中 · 3 待处理」+「上下文已用 80% · ~209K / 262K」，客户端任务 pill 停在上一轮 3/3，上下文只有 billed 累计或空环。

公共补丁只能让 live `todo_write` 工具行不再被吃掉。DSH 权威源仍是投影：Web 在 `turn/start` 后清空 standing plan；只扫工具行会对不齐。

## What Changes

- Mux `session/projection` 增接 `todos` / `contextPressure` / `contextBreakdown`。
- History 从 `projections.values` 播种同一组 key，与 live 同源。
- DSH Composer 任务 pill **优先** 用 `todos` 投影（含空列表 = 已清空），不再只吃最后一条 TodoWrite。
- DSH 上下文指示器走占用模型，不是 billed `tokenUsage` 合计：分子 `projectedTokens ?? pressureTokens`，分母 `contextWindow`；hover 展示系统提示词 / 工具 / 对话消息三行（对齐 Web ContextMeter）。
- `tokenUsage` 帧不得冲掉占用字段；三类投影独立 last-wins 合并。
- 分类数字是 heuristic 近似，文案必须带「约 / ~」，禁止加总去对占用环。

**非 BREAKING**。其它引擎的任务条 / Claude 卡 / Codex dual-view 不改语义。

## 目标与边界

- **目标**：同一 DSH session 在 mossx 与 `dsh web` 上看同一张任务表、同一个占用百分比与三分类。
- **边界**：只读 host 已有投影。不调 `ctx.tokenMeter.measure()`，不在客户端重算 surface-fold，不做 DSH 压缩按钮。

## 非目标

- 不内嵌 DSH Web UI，不把 mossx 做成 DSH plugin。
- 不把 DSH Goal dock 并进任务 pill。
- 不接 `imageLimits` / `permissions` / `plan` 等其它投影。
- 不让 Codex / Claude 改用 DSH 三分类卡。
- 不把 heuristic 三行当成计费或压缩门闩。
- 不进 Shared。

## Capabilities

### New Capabilities

- `dsh-todos-projection`: DSH 任务条以 host `todos` 投影为权威；live 与 history 同源。
- `dsh-context-usage`: DSH 上下文环以 `contextPressure` + `contextBreakdown` 为权威；`tokenUsage` 只服务底栏 billed / cache。

### Modified Capabilities

- `dsh-engine-runtime`: live mux 必须投影上述 key，不得再静默丢弃。
- `dsh-session-history`: 打开会话必须从 `projections.values` 恢复 todos / 占用，禁止只回放 tool/call。

## Impact

- Backend: `src-tauri/src/engine/dsh/events.rs`（`project_session_projection`）、`src-tauri/src/engine/dsh/history.rs`（`usage_from_history_page` + todos seed）、必要时 `EngineEvent::UsageUpdate` 合并语义。
- Frontend: DSH 线程级 todos snapshot；`Composer` / `useStatusPanelData` 对 DSH 优先投影；ContextBar / TokenIndicator 的 DSH 占用卡 + 三分类。
- Types: 复用 `ThreadTokenUsage.contextUsedTokens` / `modelContextWindow` / `contextCategoryUsages`；禁止平行 usage 类型。
- i18n: 系统提示词 / 工具 / 对话消息 / 「上下文已用」；数字前缀 `~`。
- Docs: 本 change；收口前校准 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 的 DSH projection 行。
- ADR：命中「Native rendering projection」更新触发器，archive 前必须回写校准表。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|---|---|---|
| A. 只靠公共补丁扫 `todo_write` 工具行 | 零新通道 | 对不齐 `turn/start` 清空；占用环仍空 |
| B. 客户端自己 fold history 估 todos / tokens | 不依赖投影 | 与 Web 公式漂移；`projectedTokens` 无法复现 |
| **C. 接 host 投影，UI 复用现有 pill / Context 卡（推荐）** | mux + history 同源；任务 pill 优先 snapshot；占用卡复用 TokenIndicator 布局 | 与 Web 同一权威；不新造 usage store |

采用 **C**。

## 验收标准

1. DSH 回合中 `todo_write` 后，mossx 任务 pill 与 Web 文案 / 计数一致。
2. 下一个 `turn/start` 后，在新的 `todo_write` 到来前，mossx 任务 pill 清空（或隐藏），不得留上一轮 3/3。
3. 重开同一 `dsh:<sessionId>`，任务表与占用百分比从 history projections 恢复，不必等下一次 mux 帧。
4. 占用环在 `projectedTokens`（否则 `pressureTokens`）与 `contextWindow` 都有值时显示；缺任一端不假装 0%。
5. Hover 三行：系统提示词 / 工具 / 对话消息，值为 `~` + 分类 tokens；三行之和不必等于占用分子。
6. 底栏 TTFT / tok/s / cache 仍走 `sessionStats` + billed `tokenUsage`，不被占用投影覆盖。
7. 非 DSH 引擎任务条 / Claude 卡 / Codex dual-view 无回归。
8. focused cargo + vitest 绿。不 commit。
