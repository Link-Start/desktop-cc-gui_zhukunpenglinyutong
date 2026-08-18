# Proposal: prune-stale-empty-native-sessions

> OpenSpec change id: `prune-stale-empty-native-sessions`  
> 前序：`complete-native-sidebar-session-index`（侧栏 native 只读 SQLite）  
> 本 change 不改读层合同，只补「空会话垃圾」的写层清理。

---

## Why

新建 native 会话时，引擎会先落盘空目录 / 空 jsonl，再等用户发第一条真实提问。用户点「新会话」、切引擎、或 Grok `get_or_create` 都会产生这种占位行。侧栏标题退化成 `grok session` / `claude session` / UUID（Grok 把 `session_id` 当 `first_message`）。这些行不是列表拉取 bug，是真实 Index + 磁盘记录。超过 10 分钟仍无真实用户提问的空会话，应自动删除并 tombstone，避免侧栏被占位行淹没。

## What Changes

- 在 Session Index 首页 list（非 keyset）同步之后、返回之前，跑一轮 **stale empty prune**。
- 空会话定义必须同时满足：占位标题 + 年龄 ≥ 10 分钟 + **确认没有真实用户提问**。
- Claude/Grok/PI 读盘确认；DSH 走 host 最新一页 history + `archive_dsh_session`（writer 不写 `physical_path`，禁止用空路径直接跳过）。
- 删除走既有 per-engine `delete_*` / archive + `tombstone_engine_sessions`（精确 `(engine, session_id)`），禁止只从列表隐藏。
- Shared、自定义标题、无法确认内容为空的行一律跳过。
- 单次 list 有删除上限，避免拖慢 first-paint。

**非 BREAKING**。

## 目标与边界

- **目标**：当前 workspace 里超过 10 分钟的空 native 会话从磁盘和侧栏同时消失，且 rescan 不能复活。
- **边界**：只清理 native Index 行。Shared 维持 option B，本 change 零改。

## 非目标

- 不阻止「新会话」先建空盘（10 分钟宽限期留给正在输入的用户）。
- 不按标题单独过滤；弱标题但有真实提问的会话必须保留。
- 不改 Shared、不改 transcript loader、不改 Session 管理 catalog。
- 不引入用户可配 TTL；本轮固定 10 分钟。
- 不为 locator 不稳的引擎（无 `physical_path` 且找不到目录）做猜测删除。

## Capabilities

### New Capabilities

- `stale-empty-native-session-prune`: 超过 10 分钟的空 native 会话自动删除 + tombstone。

### Modified Capabilities

- （无）`workspace-sidebar-session-loading` 读源不变；`native-sidebar-session-index` 尚未进 main specs。

## Impact

- Backend: `session_index/empty_prune.rs`（新）、`session_index/commands.rs`（首页 list 挂钩）、既有 `delete_*` / tombstone。
- Frontend: 无行为改动；list 返回页已是清理后的 Index。
- Tests: Rust 标题/年龄/磁盘确认/tombstone；不删有真实提问的行。
- ADR：不命中基石更新触发器。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 前端按弱标题隐藏 | 侧栏不画 `grok session` | 下次 sync 回来；UUID 真会话会被误藏 |
| B. 只 tombstone Index | 列表干净，磁盘残留 | CLI / 会话管理仍能扫到；不一致 |
| **C. 磁盘确认后 delete + tombstone（推荐）** | 占位标题 + 10 分钟 + 无真实提问才删 | 与手动删除同路；rescan 不能复活 |

采用 **C**。

## 验收标准

1. `grok session` / `claude session` / 标题等于 `session_id` 的行，创建超过 10 分钟且磁盘无真实用户提问 → 磁盘删除且侧栏不再出现。
2. 有真实第一条用户提问的会话，即使标题仍是弱标题 / UUID，不得删除。
3. 用户自定义标题的空会话不得删除。
4. Shared 会话不得进入 prune。
5. 删除后 tombstone，后续 sync / backfill 不得把同一 `(engine, session_id)` 插回侧栏。
6. 新建未满 10 分钟的空会话仍可见。
7. prune 失败不得让 list 失败。
