# Design: perf-session-open-tail-snapshot

## Context

`perf-session-open-stage-progress` 让幕布能报阶段。超大 DSH 打开仍卡在 `session`：`load_dsh_session` 串行打 host `session.history`，`HISTORY_PAGE_SIZE=200`、`HISTORY_MAX_PAGES=40`。host 会把 compaction 展开回 seq 空间，单页 raw `events` 可到 1.4 万，9 页累计 16 万——这是展开后的 seq，不是气泡。

共通合同其实已经在画布侧存在：

- `ConversationMeta.historyHasMore` / `historyNextCursor`
- `createOlderHistoryRequester` + 芯片「更早」
- Claude `load_claude_session(limit, before)` 默认磁盘 80

缺口：requester 硬编码 `threadId.startsWith("claude:")`；DSH / Grok / Kimi / Pi 的 `load()` 全量且不填 hasMore。生产打开走 unified `HistoryLoader`（`chatCanvasUseUnifiedHistoryLoader` 默认 true），legacy resume 分支仍会直接 `loadDshSession`，两处都要切到同一信封。

约束：

- 不重开 `shouldVirtualizeTimelineRows`
- 不改 80 / 300 / 800
- 不用 timeout 卸幕布
- 不后台预取剩余页
- 不改 Shared V0 ready-gate
- 不给 DSH 另开旁路 IPC

## Goals / Non-Goals

**Goals:**

- `HistoryLoader.load()` = tail snapshot + hasMore/cursor；幕布在 tail hydrate 后卸。
- 芯片翻页按 engine registry 走，Claude 与 DSH 共用 requester。
- DSH UI 默认 1 次 host 页（200 messages），只 fold 这一页。
- 幕布「本页 N 条」= fold 后消息数。
- `latest_assistant_text` 与未传窗的内部 load 也只取最新一页（够用且更快）。

**Non-Goals:**

- 不实现 host「不要展开 compaction」。
- 不给 Grok / Kimi / Pi 造假分页。
- 不把 chip All 接到磁盘连拉。
- 不改 remote 页事件（remote 仍可能一次返回；但必须转发 `limit` / `before`）。

## Decisions

### D1. 打开合同是 HistoryLoader tail，不是新 IPC

Claude 已经证明：command 加 `limit`/`before`，loader 把 `hasMore`/`nextCursor` 写入 snapshot meta，`hydrateHistorySnapshot` 已有 `setThreadHistoryWindow`。DSH 对齐这根管子。

**替代**：`load_dsh_tail`。会分叉打开语义，芯片还要再接一次。

### D2. DSH 窗映射：`limit` = 消息预算，默认 200 = 1 host 页

```text
max_pages = ceil(limit.unwrap_or(200) / 200).clamp(1, 40)
before_seq = parse(before) as i64
```

- UI open / chip page：`limit=200` → 1 页。
- 逃生：`limit=8000` 仍可拉满 40 页（测试 / 内部 dump），本刀 UI 不走这条。
- `nextCursor` = 本批最旧 event 的 `seq` 字符串；仅当 host `hasMore` 或因 `max_pages` 截断时返回。

内部 `history::load_dsh_session`（`latest_assistant_text`）改为同一默认 1 页。最新 assistant 在 tail，兼容。

**替代**：`limit` 当页数。会和 Claude 的「消息窗」信封不一致。

### D3. Requester 用 engine registry，不用「有 loadPage 就放行」

```text
claude:  → loadClaudeOlderHistoryPage, limit=80
dsh:     → loadDshOlderHistoryPage,    limit=200
other    → false（即使测试注入了 loadPage）
```

`deps.loadPage` 只覆盖**已注册**引擎的 loader，方便单测。`codex:` 继续 false，保住「不要把 Claude 磁盘窗套到别的引擎」。

Chip All 仍只排空 memory pending，不连拉磁盘。

**替代**：任何 prefix 只要 `hasMore` 就打默认 Claude loader。会把 80 窗误套到 DSH / Codex。

### D4. 进度计数改 fold，maxPages 改「本次预算」

Rust 每页 emit：

- `maxPages` = 本次 `max_pages`（UI 打开是 1，不再写死 40）
- `pageEventCount` / `totalEventCount` = `fold_history_events` 后的 message 数

JS 仍走 `mapDshHistoryLoadProgressEvent` 和现有 i18n key。文案「条」的语义从 raw events 收成 folded messages。打开只拉 1 页时，幕布短暂显示「第 1 / 1 页」后卸；更早内容靠芯片，不靠 1/40 假装还会自动翻。

**替代**：继续报 raw events。用户会再次看到「本页 14476 / 累计 161883」。

### D5. Grok / Kimi / Pi：信封对齐，本刀不造页

loader meta 显式 `historyHasMore: false`、`historyNextCursor: null`。磁盘仍一次读完。JS `load*Session` 可接受可选 `{ limit, before }` 以便将来接入，本刀不根据它们切片，也不回假 cursor。

**替代**：按字节/行数假装分页。会丢消息边界，芯片第二次点可能重复或空洞。

### D6. 页边界 fold 信任 host message 窗

host `maxMessages=200` 按 message 对齐。打开只 fold 最新一页；chip 再 fold 更旧一页后 prepend。跨页 tool/call+result 可能对不上——与 Claude 磁盘窗同一类边界，本刀不在 JS 做跨页拼工具。完整 40 页逃生路径仍是「先拼 events 再 fold 一次」，保住内部 dump 的跨页 assistant buffer。

### D7. 双路径都切：unified loader + legacy resume

`chatCanvasUseUnifiedHistoryLoader` 默认 true，但 `useThreads` 测试和 flag=false 仍走 `useThreadActionsResumeThread` 里的 `dsh:` 分支。两处都传 `{ limit: 200 }`，并从 payload 写 `setThreadHistoryWindow`。禁止只改 loader 让 legacy 继续 40 页。

## Risks / Trade-offs

- [Risk] 用户以为「打开就是全部历史」，点芯片才看到更早用户消息 → Mitigation：芯片沿用现有「更早」；打开后 `hasMore` 必须为真时显示。不另做第二套提示。
- [Risk] first-paint 内存余量把 `nextCursor` 写成 `"memory"`，All 抽干后 disk seq 丢失、芯片消失 → Mitigation：`historyWindowByThread` 只存 host cursor；内存余量只活在 pending store。hydrate / projection / 部分抽干都不得覆盖可消费 disk cursor。事实源：dump `session-817dbcda…`（44663 events / seq 161882）。
- [Risk] 最新一页全是超长 assistant/tool，看不到最近一条 user → Mitigation：host 页是 200 messages，dump 里 180 user / 77 turn，tail 200 足够覆盖最近多轮。不够再靠芯片。不做自动回翻。
- [Risk] `nextCursor` 用 event seq，host `beforeSeq` 语义漂移 → Mitigation：复用今天 `load_history_pages` 已验证的 `events.first().seq`；单测锁解析与截断。
- [Risk] remote 不识新字段 → Mitigation：字段可选；未传时服务端默认 1 页。若旧 daemon 忽略 limit 仍拉 40 页，行为不优于今天，但不更差于今天。
- [Risk] 把 1 页默认套到「真要全量」的调用方 → Mitigation：已盘点：UI open、chip、`latest_assistant_text`。全量逃生显式 `limit=8000`。

## Migration Plan

1. Rust 窗 + result 字段（默认 1 页）。
2. JS command / loader / requester registry / DSH page loader。
3. legacy resume 与 unified 双路径对齐。
4. 进度计数 + i18n 语义。
5. 回归 Claude / Shared / 虚拟化守卫。
6. 回滚：revert 本 change 即回到 40 页全量；无存储格式迁移。

## Open Questions

- 无。host compaction 不展开留到独立 change。
