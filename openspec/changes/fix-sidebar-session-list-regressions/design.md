## Context

侧栏读层已是 Session Index SQLite；Shared 仍扫目录。工作区里另一路 AI 已半落地 provider 列、全局开关、pending skip。本设计在那之上收口绑回、占位口径、v2 list、刷新 merge。

约束：不把 Shared 折进 `session_index`；不把 catalog 扫盘搬回切项目；子会话挂载不变。

## Goals / Non-Goals

**Goals:**

- 六条回归同一合同落地
- Shared 侧栏权威 = `shared_sessions_v2`
- 顶层一对一 + 当前对话可见

**Non-Goals:**

- Shared 写入 `session_index`
- 引擎 disk list 回热路径
- 无关 rust 格式化入库

## Decisions

### D1：一个 change 吸收两个半成品

`restore-native-provider-labels` 与 `stabilize-native-sidebar-during-execution` 文件与本 change 高度重叠。并行会再撞 `sessionIndex*` / `useThreadActions*`。吸收后删除那两个未跟踪目录。

备选：续跑两个再开第三个 → 否决。

### D2：选会话绑回走 ThreadSummary，不新开 IPC

Index overlay + 前端透传已经把 `providerProfileId/Name` 放到 summary。`commitThreadSelection` 带上这两字段设 picker。send 在用户未改选时 MUST 使用 active thread binding，禁止「全局上次选中」当请求参数。

备选：选会话再读 catalog metadata JSON → 多一跳、和 Index 再分叉。

### D3：占位隐藏带当前对话豁免

```text
顶层 hide = （pending id OR 弱标题）AND 不是 active AND 无自定义标题
一对一 = pending→real 后 tombstone pending，禁止两条顶层
子会话 = parentThreadId 非空不走顶层 hide，仍挂父下
```

弱标题：`{engine} session` / `{Engine} Session` / `DeepSeek Harness Session` / `Agent N` / `Warmup` / 短 hex。

Index 仍可写入 real id（完整性）；可见性由投影决定，不靠「不写账本」藏草稿。

备选：对话中也藏当前行 → 用户找不到正在聊的槽。否决。

### D4：Shared 先补 v2 列再改 list

`shared_sessions_v2` 现无 `workspace_id` / `title`。只改读 = 空列表。

Migration `SCHEMA_VERSION` 2 → 3，additive：

- `workspace_id TEXT`
- `title TEXT`
- index `(workspace_id, updated_at DESC)`

写入点：创建、改标题、选 target。升级首次 list 前从 meta 目录 backfill 一次（写层，不挂 first-paint 热路径）。`native_thread_ids` 从 `shared_binding_state` 聚。

list 失败 closed：migration 失败按现有 event log 打开策略拒绝，不得 silently 扫目录假装完整。

备选：list 时 JOIN 目录 meta → 仍依赖扫盘，漏写会再漏读。否决。

### D5：刷新只增不减

`session-index-imported` 与 focus 禁止 `startupHydrationMode: "first-paint"`。最终 `setThreads` 的 membership = Index ∪ 现有 ∪ last-good；tombstone / 用户删除 / 权威空证明先于 union。stale `requestSeq` 不得提交。

备选：拉大 Index 首页 limit 装完整 → 数字军备，不修 merge。否决。

## Risks / Trade-offs

- [v2 旧行无 workspace_id] → 首次 backfill 从 meta 补；补不上的行不进该 workspace 侧栏，可观测日志，不扫盘冒充。
- [当前对话弱标题可见] → 切走后按 hide 藏；避免永久 Agent N 堆顶。
- [overlay 读 metadata JSON] → 仅缺列时跑；失败静默无标签，list 不报错。
- [工作区脏 rust] → 提交时按路径白名单，禁止整树 add。

## Migration Plan

1. 吸收半成品相关文件，修 `store.rs` 双 `#[test]`。
2. P0 标签投影 / 绑回 / 占位 / merge。
3. P1 v2 migration + backfill + list 切读。
4. 删除两个被吸收的未跟踪 change 目录。
5. 回滚：整 PR revert。v2 列 additive，旧客户端忽略新列可读。

## Open Questions

无。拍板已覆盖范围、读源、占位口径。
