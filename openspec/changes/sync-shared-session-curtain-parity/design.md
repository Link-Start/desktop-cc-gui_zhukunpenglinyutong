## Context

- 渲染核已统一：`MessagesCore` / `messagesTimelineProjection` / `ToolBlockRenderer` / process phase collapse 对 Native 与 Shared 一视同仁。
- Shared 数据入口：
  - **Live**：`project_app_server_event_to_shared_owner` 改写 `threadId` → `sharedRealtimeAdapter` → `buildConversationItem`（富 item）
  - **History**：`createSharedHistoryLoader` → `load_shared_projection` → `SharedProjector` → `toSharedConversationItems`
- 今日 Native 幕布升级主要落在 Messages + engine live 桥；Shared 历史 projector 未同步终轮 meta 与 tool 呈现字段。

## Goals / Non-Goals

**Goals**

1. History rebuild 后 Shared 终轮 footer 与 Native 同契约字段。
2. History tool 项具备幕布分类与 fileEdit/read 所需最小字段。
3. 保持 Canonical 摘要边界：不强制把完整 private payload 塞进 projection。

**Non-Goals**

- 不实现完整 artifact materialization 回填 diff。
- 不改 live text channel / scroll authority。
- 不改 Hidden Binding 可见性策略。

## Decisions

### D1. Footer meta 在 projector 盖章（采用）

- 在 `project_events` 第一遍收集：
  - `attempt_id → requested_at`（TurnRequested）
  - `attempt_id → preferred UsageShape`（已有 precedence）
- `project_turn_committed` 写 assistant message 时附加：
  - `finalCompletedAt = committed_at`
  - `finalDurationMs = max(0, committed_at - requested_at)`（有 request 时）
  - `finalInputTokens = input + cached_input`（与 FE `resolveTurnTokenCountsFromUsage` 对齐）
  - `finalOutputTokens = output`
- **仍 emit** `metadata/usage` 项，避免破坏 shadow comparator / 既有 usage 测试。
- FE `dataSource` 已映射 final* 字段，无需改契约名。

### D2. Tool 呈现字段增强（采用 · review 修订）

- 保留 `title = tool_name`。
- `toolType`：
  - **仅** bash/shell/command/terminal → `commandExecution`（hide 策略）
  - **其余保留原始 tool_name**（Write/Edit/Read）。强改 `fileChange` 会让 FE `ToolBlockRenderer` 走 GenericToolBlock，绕过 Native 同款 `EditToolBlock`/`ReadToolBlock`（水土不服）。
- fileEdit 场景分组仍靠 `classifyToolCategory(title)`，不依赖 toolType=fileChange。
- detail JSON 含 path 时，edit-like 工具仍可附 `changes: [{ path }]` 给汇总卡。
- 不在此阶段物化完整 patch artifact。

### D4. Checkpoint version bump（review 补）

- `CANVAS_PROJECTION_VERSION` 3 → 4：已有 canvas checkpoint 强制 rebuild，避免增量 merge 永久保留旧瘦 item。
- `project_events` 末 + `project()` merge 后二次 `stamp_usage_tokens_onto_final_assistants`：Usage 晚于 Commit 时仍盖章 token。

### D5. Process-before-prose order（折叠对齐 · 2026-08-01）

- **问题**：`project_turn_committed` 原先「全部 blocks（含 Text）→ 再全部 tools」把过程甩到结论后；Messages `resolveCollapsedTimelineItems` 只折叠「结论正前方」过程 → Shared 无 chip、工具堆尾。
- **修复**：投影顺序改为  
  `reasoning/redacted/artifacts → tools → final Text message(s)`（失败 outcome / empty provenance 仍在最后）。
- **不**改 Messages 折叠核；不重新造轮子。
- `CANVAS_PROJECTION_VERSION` → **5** 强制旧 checkpoint rebuild。
- 局限：Canonical 仍无 tool↔text 交错时间戳，无法 1:1 还原 live interleave；但满足折叠契约与 Native 默认可读结构。

### D6. Codex fileChange fidelity（文件修改场景）

- **问题**：Codex `fileChange` 的 path/diff 在 `item.changes[]`，ingest 只抓 `arguments`/`input` → 历史投影无 `changes[]` → 幕布组不出「文件修改」。
- **边界**：只补 Codex 工具 payload 打包与投影还原；不改 Native `buildConversationItem`；不把 Write 强改 fileChange toolType。
- **实现**：
  1. `extract_codex_tool_payload` 合并 arguments + `changes[]`
  2. completed 前 `ToolInputUpdated` 合并 summary（JSON object merge）
  3. Projector 从 detail 还原 `changes[]`；name/payload 为 fileChange 时 toolType=`fileChange`、title=`File changes`
  4. `CANVAS_PROJECTION_VERSION` → **6** 强制 rebuild
- **局限**：已落盘的旧 canonical 若从未带 changes，无法魔法恢复；需新回合或 rebuild 后新写入。

### D3. 不碰 Messages 核（采用）

- process phase collapse / merge adjacent reasoning / lightweight off 已共通。
- Shared 只需喂对 ConversationItem 形状即可“继承”今日 UI 升级。

## Risks / Mitigations

| 风险 | 缓解 |
|------|------|
| toolType 改写导致 comparator mismatch | comparator 已只比 toolType/status 等；补测试固定新映射 |
| duration 无 requested_at | 只写 finalCompletedAt，不写假 duration |
| usage 无 tokens | 不写 0 token 噪声字段 |
| 过度拟合 engine 名表 | 分类启发式与 `events.rs` resolve_tool_item_kind 同构，保持保守 |

## Implementation Outline

1. `projector.rs`：context 收集 + stamp final meta + tool type/changes
2. Rust tests：request+commit+usage → assistant 含 final*；Write tool → fileChange + path
3. FE test：final* + changes 透传
4. 可选：analysis 文档补 Shared history 行

## Open Questions

- artifact 全量 diff 回填是否进入 follow-up change？（默认 yes，本 change 不做）
