# Design: wire-dsh-todos-and-context-usage

## Context

DSH Web 不扫工具行。任务条是 `TodoDock`：`useProjection("todos")`，值为最新 `todo/write` 的整表；下一个 `turn/start` 后 standing plan 为空。上下文环是 composer 尾部 ContextMeter：

```
occupancy = (projectedTokens ?? pressureTokens) / contextWindow
breakdown  = { systemTokens, toolsTokens, messageTokens }   // heuristic，带 ~
```

三个 token-meter 投影互相独立、last-wins，**不是**一次请求的原子快照。`tokenUsage` 是全日志 billed 桶，给统计条 / cache hit，不给占用环。

mossx 现状：

| key | mux | history | UI |
|---|---|---|---|
| `tokenUsage` | → `UsageUpdate`（无窗口 / 无分类） | `projections.values.tokenUsage` | 底栏 billed；占用环缺分母 |
| `sessionStats` | → `dsh-session-stats` Raw | 已播种 | 底栏 TTFT / tok/s |
| `todos` | 丢弃 | 不 fold `todo/write` | 任务 pill 扫 TodoWrite 工具行 |
| `contextPressure` | 丢弃 | 不读 | 无 |
| `contextBreakdown` | 丢弃 | 不读 | 无 |

公共 change `fix-todo-write-file-change-misclassify` 只保证 live `todo_write` 不被收成 fileChange。没有本 change，DSH 仍对不齐 Web 的清空时机与占用卡。

## Goals / Non-Goals

**Goals:**

1. Mux 与 history 同源接 `todos` / `contextPressure` / `contextBreakdown`。
2. DSH 任务 pill 以投影为权威，含「空列表 = 已清空」。
3. DSH 上下文环用占用模型 + 三分类 hover，数字带 `~`。
4. `tokenUsage` / `sessionStats` 语义不变，且不得冲掉占用字段。

**Non-Goals:**

- 客户端重实现 `surface-fold` / `projectedTokens`。
- DSH 压缩按钮、Goal dock、其它投影 key。
- 非 DSH 引擎改用这张卡。
- Shared。

## Decisions

### D1. 权威源是投影，不是工具行

**选定**：DSH 线程持有一份 `todos: TodoItem[] | null`。

- `null`：尚未收到投影（新会话、host 未挂 token-meter 之外的 todo 单元）。任务 pill **回退** 扫 `todo_write` 工具行（公共补丁修好后可用）。
- `[]`：host 明确清空（`turn/start` 后）。任务 pill **必须隐藏**，禁止回退工具行。
- 非空数组：原样展示。

不采用：继续只扫工具行。Web 在 `turn/start` 清空，工具行还在，两侧必漂。

不采用：客户端 fold `todo/write` 事件当权威。host 已有 last-write-wins + 清空规则；重复实现会漂。

### D2. 占用环复用 ThreadTokenUsage，不平行一套 store

**选定**：把 pressure / breakdown 填进现有 `ThreadTokenUsage`：

| 投影字段 | mossx 字段 |
|---|---|
| `contextPressure.projectedTokens ?? pressureTokens` | `contextUsedTokens` |
| `contextPressure.contextWindow` | `modelContextWindow` |
| 有窗口且有分子 | `contextUsedPercent` = 分子 / 窗口 × 100 |
| `contextBreakdown.systemTokens` | `contextCategoryUsages[0]` name=`system` |
| `toolsTokens` | name=`tools` |
| `messageTokens` | name=`messages` |
| 来源 | `contextUsageSource = "dsh-context-pressure"` |
| 新鲜度 | `contextUsageFreshness = "live"`（history seed = `"restored"`） |

`tokenUsage` 帧只更新 billed 四桶 + `cacheWriteInputTokens`，**禁止**把 `contextUsedTokens` / `modelContextWindow` / `contextCategoryUsages` 写成 None。三类投影独立 merge。

不采用：新 `DshContextUsage` 全局 store。根链已经有 `tokenUsageByThread`；再挂一份违反 render-perf 红线。

### D3. UI：DSH 走 Claude 同构卡，而不是 Codex dual-view

**选定**：

- 任务：`Composer` 对 `selectedEngine === "dsh"` 且 snapshot 非 `null` 时，用 snapshot 覆盖 `useStatusPanelData().todos`。
- 占用：扩展现有 TokenIndicator / ClaudeContextCard 为「可带分类行的占用卡」，或抽一层无引擎名的 `ContextOccupancyCard`。DSH 与 Claude 共用 header（百分比 + 已用/总量 + 进度条）；**仅 DSH** 在 header 下画三行分类。Claude 卡保持现状（测试已钉死「无分类行」）。
- 分类 label 走 i18n：`composer.dshContextSystem` / `Tools` / `Messages`，值 `~1.5K`。
- 缺 `contextWindow` 或分子时：显示空环 + 「等待回传」，禁止画 0%。
- 不启用 Codex compaction 控件。

不采用：把 DSH 塞进 `contextDualViewEnabled`。那条路径绑 Codex compaction lifecycle。

### D4. History 从 `projections.values` 播种，不回放全量 todo/write

**选定**：`usage_from_history_page` 同时读 `todos` / `contextPressure` / `contextBreakdown`。`load_dsh_session` 把 todos 与 usage 一并交给 frontend hydrate。

`fold_history_events` **仍可**忽略 `todo/write` 行——幕布不需要它，任务条走 snapshot。避免 history 里堆一串隐藏 TodoWrite 卡。

### D5. 未知投影 key 继续丢弃

只加白名单三 key。`imageLimits` / `permissions` / `plan` / `goal` 本 change 不接。Goal 已有独立折叠卡。

## Data flow

```
dsh web / host
  todo_write.execute → session.append("todo/write")
  token-meter units  → session/projection { todos | contextPressure | contextBreakdown | tokenUsage | sessionStats }

mossx mux
  todos             → thread todos snapshot (null | [] | items)
  contextPressure   → merge usage.contextUsedTokens / modelContextWindow / percent
  contextBreakdown  → merge usage.contextCategoryUsages
  tokenUsage        → merge billed buckets only
  sessionStats      → existing Raw

Composer
  DSH todos snapshot ?? scan TodoWrite tools
  DSH occupancy card ← ThreadTokenUsage
```

## Risks / Trade-offs

- `projectedTokens` 在 compaction 后先于下一轮 usage 更新；`pressureTokens` 会短时偏旧。必须优先 `projectedTokens`，与 token-meter README 一致。
- 三分类是 4 chars/token heuristic，CJK / JSON schema 会偏低。UI 必须 `~`，禁止拿三行去对占用分子。
- host 未挂 token-meter 时 key 可能缺席。`todos=null` 才回退工具行；占用卡保持 empty，不估 0。
- 高频 `session/projection` 只写 thread store，禁止挂 AppShell 根 setState（已有 tokenUsage 通道）。

## Migration

无磁盘格式变更。旧会话打开时若 history page 带 `projections.values`，一次 hydrate；没有则 todos 保持 `null`，回退工具行。

## ADR

收口 / archive 前刷新 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`「零、当前实现校准」DSH projection 行：写明 `todos` / `contextPressure` / `contextBreakdown` 的事实源文件。

## Open Questions

无。压缩按钮、Goal 并入任务条明确不做。
