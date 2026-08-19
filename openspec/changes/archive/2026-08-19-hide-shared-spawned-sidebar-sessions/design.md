## Context

用户 Windows 侧栏被 Shared×Claude 续跑 jsonl 和其子代理灌满。本机 Codex 另有 32 条 TUI/Desktop 亲儿子，必须当负例。

当前闸门：

1. hide set ≈ 当前 binding UUID
2. Claude Index 优先 `history.jsonl` 标题，MOSSX 包被跳过
3. `isSharedSidebarHiddenPup` 要求 parent ∈ hiddenParentKeys；keys 只有 `shared:` + `nativeThreadIds`
4. live list 能因 `MOSSX_` firstMessage 丢 owner，Index merge 又加回来
5. Codex child parent 在 `source.subagent.thread_spawn.parent_thread_id`，解析已存在；缺的是「parent 是否 Shared-owned」

幕布 / Strip 已依赖 store 里的 child 行，侧栏藏崽不得删 store。

## Goals / Non-Goals

**Goals:**

- Index 以 transcript 协议 omit Shared owner
- protocol hide 收录文件 UUID
- parent 命中 Shared-owned 则侧栏不进树
- Native Codex 树（Socrates/Singer）零误伤
- 碰撞测试：Claude dump 正例 + 本机负例

**Non-Goals:**

- 标题猜测、originator 猜测
- 改幕布渲染
- 删磁盘 jsonl
- 藏全部 thread_spawn

## Decisions

### D1. Index omit 看正文，不看 history 标题

`claude_index_row_from_file` 在采用 `title_from_history` 之前，先 peek 首条真实 user。`is_claude_control_or_synthetic_user_text` 命中 MOSSX → `None`（omit）。history「继续」不得成为入库标题。

备选：入库后靠 FE 标题闸。拒绝：标题已被 preview 成「继续」。

### D2. protocol hide 收录文件 sessionId

`protocol_hidden_ids_from_index_rows` 今天只看已入库行的 title。omit 之后行不在 Index，必须在 peek/omit 路径把 `{fileUuid}` / `claude:{fileUuid}` 写入 `protocolHiddenNativeIds`（或等价扫描结果）。子代理 parent 用的就是文件 UUID。

备选：只 expand binding。拒绝：binding ≠ 文件 UUID。

### D3. 侧栏 pup hide 的 parent 键 = Shared 行 nativeThreadIds ∪ protocol file ids ∪ `shared:`

`buildSharedSidebarHiddenParentKeys` 并入 protocol hide。`isSharedSidebarHiddenPup` 保持只认 parent-id，不认标题。parent 不在 `threads` 时仍 hide（禁止升根）。

### D4. Codex 只走 thread_spawn parent ∈ hide set

沿用 `resolveCodexSubagentIdentity` / `local_usage` 已解析的 parent。禁止读 child.meta.session_id 当自己的 id（那是父 id）。TUI 负例 parent 不在 hide set → 可见。

### D5. 碰撞测试是验收门，不是手测替代

正例：用户 dump 里 MOSSX owner + `subagents/`。负例：本机 Socrates/Singer 两条 uuid。实现为 unit/fixture 测试，不依赖打开 GUI。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| peek 跳过 MOSSX 后误用后续 tool_result 当标题入库 | omit 发生在「任一首条真实 user 为 MOSSX」，不是 skip-and-continue |
| 超大首行被 256KiB cap skip | MOSSX 在行首；cap skip 后若未见真实 user，保守 omit 或再读行首 N 字节。实测 dump 首行 < 80KiB |
| protocol hide 漏子代理 | hide 键含文件 UUID；child parent 正是该 UUID |
| 误藏 Native Codex | 负例写死 Socrates/Singer；无 Shared parent 不 hide |
| Index omit 后 live list 仍扫出 owner | live firstMessage 仍以 MOSSX_ 开头，现有 title 闸可丢；final strip + protocol hide 双保险 |

## Migration Plan

无需数据迁移。下次 Index sync 自然 omit。回滚：还原 writer / visibility / `useThreadRows` 三处。

## Open Questions

无。`Base directory` 不作为独立 hide 规则。
