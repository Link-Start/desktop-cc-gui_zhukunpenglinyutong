# Proposal: perf-session-open-tail-snapshot

> OpenSpec change id: `perf-session-open-tail-snapshot`  
> Skill: `openspec-ff-change`  
> Evidence: 幕布已能定位卡点（`perf-session-open-stage-progress`）；超大 DSH 会话仍卡在 `session/snapshot`，host `session.history` 最多串行 40 页 × 200 message，单页可展开成 1.4 万 raw events。dump `session-817dbcda…` 实测第 9/40 页累计 161883 是 host 展开后的 seq 空间，不是 16 万气泡。  
> 邻近 change（禁止混进本 diff）：`perf-session-open-stage-progress`、`perf-large-transcript-first-paint`、`fix-claude-history-disk-window-load-more`、`fix-shared-history-projection-nonblocking`

---

## Why

打开税不在 first-paint / 芯片 / 幕布文案，而在 `HistoryLoader.load()` 把整段 transcript 拉完才卸幕布。Claude 已经有 tail window + `historyHasMore` + 芯片翻页；DSH / Grok / Kimi / Pi 的 `load()` 仍是全量。下一刀必须是**共通尾窗合同**，不是 DSH 私有旁路。看不见卡点的刀已经砍过了；现在要把 15 秒从「拉 40 页」砍成「拉最新 1 页」。

## What Changes

- `HistoryLoader.load()` 只取 **tail snapshot**，并把 `historyHasMore` / `historyNextCursor` 写进 `ConversationMeta`。幕布在 tail hydrate 后卸。
- 「更早」芯片走已有 `OlderHistoryRequester`；去掉 `claude:` 硬门，改成 **engine registry**（有 page loader 才能翻盘）。
- DSH `load_dsh_session(limit, before)` 与 Claude 同信封。UI 默认 1 页（200 host messages），只 fold 这一页；`hasMore` / `nextCursor`（`beforeSeq`）回给 JS。
- Claude：回归 only。磁盘窗仍是 80，芯片路径不改语义。
- Grok / Kimi / Pi：同一 `hasMore` 信封。本刀不造假分页；全量返回时 `historyHasMore=false`。
- Shared：不把幕布重新绑回 projection；V0 ready-gate 不动。
- 幕布页进度改报 **fold 后的 message 数**，不再把 host `events.len()` 当成条数。
- **不**后台自动把剩下 39 页拉完。**不**给 DSH 另开一条绕过芯片的 IPC。

## 目标与边界

- **目标**：超大会话打开只付「最新一页 host + fold + 现有 first-paint」的税；更早内容只在用户点芯片时按页取。
- **边界**：打开路径的 history 窗合同（loader / command envelope / requester registry / DSH 一页适配）。不改 80/300/800，不重开虚拟化。
- **兼容**：未注册 page loader 的引擎（Codex / Gemini / OpenCode）保持今天「无磁盘翻页」；Claude 芯片与磁盘 80 保持绿。`latest_assistant_text` 只需要最新一页。

## 非目标

- 不重开时间线虚拟化 / 行级 lightweight 墙。
- 不全局缩小 80 / 300 / 800。
- 不用固定 timeout 当打开完成。
- 不后台预取剩余 host 页。
- 不把 host compaction「不要展开」做成这刀（那是后续 host capability）。
- 不改 Shared V0 幕布门闩。
- 不给 Grok / Kimi / Pi 造假 `hasMore`。
- 不在 AppShell 根链新挂状态。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|------|------|------|
| **A. 共通 tail + requester registry（采用）** | `load()` = tail；芯片按 engine 翻页；DSH 默认 1 页 | 修 15 秒，且 Claude / 未来引擎共用同一合同 |
| B. DSH 私有 `load_dsh_tail` | 新 IPC，芯片旁路 | 快，但第二套打开语义；Claude 合同继续分叉 |
| C. 打开仍拉 40 页，只改文案 / 百分比 | 已经做完 | 看得见卡点，砍不掉墙钟 |
| D. 后台静默拉完剩余页 | 幕布先卸，IPC 继续 | 打开看似快，主线程/host 仍被 39 页打满；和「点了才翻」冲突 |

## Capabilities

### New Capabilities

- `session-open-tail-snapshot`：会话打开只装配 tail snapshot；更早历史必须经统一 older-page 合同显式请求。

### Modified Capabilities

- （无主 spec 增量）`conversation-curtain-assembly-core` 已有 `historyHasMore` / `historyNextCursor`；本 change 是让非 Claude 引擎真正填这个合同，不改装配 REQUIREMENTS。页进度条数口径在邻近 change `session-open-stage-progress` 的实现里收紧，不另开 capability。

## Impact

- `src-tauri/src/engine/dsh/history.rs`：`limit` / `before` 窗；`DshSessionLoadResult.hasMore` + `nextCursor`；进度计数改 folded messages。
- `src-tauri/src/engine/session_history_commands.rs`：`load_dsh_session` 转发 `limit` / `before`（含 remote）。
- `src/services/tauri/session.ts`：`loadDshSession(..., { limit, before })`。
- `src/features/threads/loaders/dshHistoryLoader.ts`：`load()` 默认 1 页并写 meta。
- `src/features/threads/utils/createOlderHistoryRequester.ts`：engine registry，去掉 `claude:` 硬门。
- 新 `loadDshOlderHistoryPage`；Claude page loader 保持。
- Grok / Kimi / Pi loader：显式 `historyHasMore: false`。
- 幕布 i18n：页细节仍用现有 key，数值改为 folded message。
- 测试：requester / DSH page / loader meta / rust window helper；既有 Claude / Shared / 虚拟化守卫保持绿。

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| A | DSH 打开默认只打 1 次 host `session.history`（200 messages），幕布在 tail hydrate 后卸 | rust window 单测 + loader 调用参数 + 手测 dump |
| B | host `hasMore` 时芯片「更早」可再取一页，且不重定位到底部 | requester + DSH page 单测；沿用既有 scroll restore |
| C | 非注册引擎（如 `codex:`）点芯片不会走 Claude 磁盘窗 | 既有 requester 单测仍绿 |
| D | Claude 磁盘 80 + 芯片语义不变 | `loadClaudeOlderHistoryPage` + requester Claude 用例 |
| E | Shared V0 幕布门闩不被改绑 | Shared restore 单测 |
| F | 进度「本页 N 条」是 fold 后消息数，不再是 raw `events.len()` | rust progress count + mapper 单测 |
| G | 虚拟化仍关；80/300/800 不变 | 常数 / 虚拟化守卫 |
| H | 无后台 39 页预取；无 timeout 卸幕布 | 代码审查 |
