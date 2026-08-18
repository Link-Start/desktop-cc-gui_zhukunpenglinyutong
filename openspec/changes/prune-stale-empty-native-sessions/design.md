# Design: prune-stale-empty-native-sessions

## Context

侧栏 native 已只读 `session_index`。空会话来自「先建盘、后提问」：

- 用户点新会话 / 切引擎 → 前端先 `writeClientCreatedSessionIndex` 写入 `{engine}-pending-{millis}-{nonce}`，此时**没有**引擎磁盘文件。
- 用户真正发第一句后，pending id 才换成引擎 session id，并落盘。
- 若用户只点开不提问，pending 行会永远停在 Index；旧 confirm 按「找不到盘 = Unknown」跳过，这是侧栏一夜空会话的主因。
- 另有真引擎空会话：Claude 写空 jsonl，Grok `get_or_create` 建 `sessions/<encoded-cwd>/<id>/`。
- Index upsert 标题为空时落成 `{engine} session`；Grok 无真实 user prompt 时 `first_message = session_id`，侧栏显示 UUID。
- `session_index` 没有 `message_count`。弱标题 ≠ 空内容。

既有删除合同：`delete_claude_session` / `delete_grok_session` / … + `tombstone_engine_sessions`（prune 专用，按 `(engine, session_id)`）。手动删除仍走 `tombstone_session_ids`。

## Goals / Non-Goals

**Goals:**

- 首页 list 返回前清掉当前 workspace 里 ≥10 分钟的确认空 native 会话。
- 删除与手动删除同路，tombstone 防复活。
- 判断必须保守：确认不了为空就留着。

**Non-Goals:**

- 不改 first-paint 读源，不扫盘重建列表。
- 不清理 Shared。
- 不在无法定位磁盘文件的引擎上猜测删除。
- 不把 prune 做成独立用户命令或设置项。

## Decisions

### D1. 挂钩点：`list_session_index_for_workspace` 首页

keyset「更多」是纯翻页，禁止再跑 writer。prune 只挂 first page，且在 sync 之后、SQL list 之前。prune 失败只记日志，list 仍返回。

备选：前端识别后调 `delete_workspace_sessions`。否决：前端没有磁盘确认，会误删 UUID 标题的真会话。

### D2. 三闸门同时成立才删

1. **占位标题**：prefix 匹配 `{engine} session`（含 `PI session {8hex}`）、`DeepSeek Harness Session`、`Warmup`、`Agent N`、短 hex、control-plane tag，或标题等于 `session_id`。自定义标题直接跳过。
2. **年龄**：`created_at` 优先且 **sticky**（upsert `COALESCE(session_index.created_at, excluded.created_at)`，DSH 刷新不得重置 10 分钟钟）。否则 `updated_at`。`now - anchor >= 10min`。
3. **确认无真实用户提问**，扫描结果是三态 `HasUser / ScannedEmpty / Unknown`。**只有 `ScannedEmpty` 可删**；open 失败、预算耗尽、缺文件一律 `Unknown`：
   - Claude：`physical_path` 或 reconstructed jsonl。无参数 `/resume` `/clear`、`<local-command-*>`、caveat、`Warmup`、剥掉注入信封后为空，不算真实提问。带非空 `<command-args>`、信封后仍有正文、或 image-only user = `HasUser`。**缺文件 / 打不开 = `Unknown`，禁止 tombstone-only。**
   - Grok：先 O(1) encoded-cwd，未命中再 bounded 扫描 `sessions/*/<id>/`。找不到目录、或目录里没有 `chat_history.jsonl` → **跳过**。
   - PI：定位 `*_{sessionId}.jsonl`。writer 标题是 `PI session {8char}`，分类器必须 prefix 匹配。找不到文件 → 跳过。
   - DSH：无本地文件。`connect_existing`（禁止 `ensure_ready`）peek 最新一页；无真实 user 且 `hasMore=false` 才 archive。host 未挂 / peek 失败 / `hasMore` → 跳过。
   - Codex / Gemini / Kimi：仅当 `physical_path` 存在且 0 字节或文件已消失。无路径 / metadata 失败 / 文件已长大 → 跳过。
   - 本地 pending 草稿：`session_id` 匹配 `{engine}-pending-{millis}-{nonce}`（`writeClientCreatedSessionIndex`）→ **已确认空**，`delete_disk=false`，只 tombstone。这不是 locator miss。`*-pending-shared-*` / `*-pending-subagent:*` 仍跳过。
   - OpenCode / Shared：跳过。

### D3. 删除走既有 API + tombstone

确认后、删除前再扫一次确认路径（`still_empty_before_delete`）；用户在 collect 与 delete 之间打了字则跳过。成功或「已不存在」再 `tombstone_engine_sessions([(engine, session_id)])`，禁止用裸 `session_id` 跨引擎打标。删除失败 / 无确认路径不 tombstone。DSH archive 在 peek 已确认 Empty 后若 host 回 not-found，视为已从 host 消失，允许 tombstone。

### D4. 预算

扫描上限 200 行 / workspace（path-equivalent merge 后）。单次删除上限 20。超过留给下一次 list。

DSH 挂在 list 首页同步路径上：`connect_existing` 2s 超时；peek 并行且总预算 3s；archive 复用同一次 attach 的 client，禁止每个 id 再 connect。超时/host 未挂 → 跳过，不得猜删。

Grok/PI/Claude 确认命中的磁盘路径必须写进 `PruneTarget.physical_path`。引擎 `delete_*` 因 cwd 编码漂移返回 not-found 时，MUST 回退删除该确认路径，禁止「只 tombstone、盘还在」。

### D5. 不保护当前选中行

10 分钟宽限期覆盖「刚点开准备输入」。不给 list API 加 `protect_session_ids`，避免扩大合同。若现场误删正在看的空画布，再补保护参数。

## Risks / Trade-offs

- [弱标题 + 提取失败的真会话] → 磁盘 peek 是硬闸；提取到任何真实 user 文本即保留。
- [Grok 编码变体找不到目录] → 跳过，宁可留空行也不蒸发真会话。
- [Grok 批量改 `updated_at`] → 年龄锚点用 `created_at`。
- [first-paint 多 20 次删除] → cap + 仅首页；peek 只读文件头。
- [用户自定义的空草稿] → 非占位标题一律跳过。
- [某引擎只剩 pending 被 tombstone 后 Index 页缺该引擎] → last-good extras 禁止补回 `{engine}-pending-{millis}-{nonce}`；真会话 last-good 仍保留。

## Migration Plan

无需 schema。上线后下一次打开 workspace 的首页 list 即清理存量。回滚：去掉 list 挂钩即可，tombstone 行保持删除语义（与手动删除一致）。

## Open Questions

无。TTL 固定 10 分钟。
