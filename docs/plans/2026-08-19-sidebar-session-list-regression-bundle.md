---
type: plan
status: active
created: 2026-08-19
---

# 实施计划：左侧 Session 六条回归一起收

> **Lifecycle**: active。执行以 OpenSpec change `fix-sidebar-session-list-regressions` 为准。
>
> 诊断：[`../analysis/sidebar-session-list-regression-bundle-2026-08-19.md`](../analysis/sidebar-session-list-regression-bundle-2026-08-19.md)

## 拍板

- 六个一起改
- Shared 读 `shared_sessions_v2`；写入不够先补写入
- 当前对话可见；草稿占位一律隐藏；一对一顶层；子会话挂载不变

## 进度（2026-08-19 切会话卡死拆掉之后）

最初 6 点对照：

| # | 最初诉求 | 状态 |
|---|---|---|
| 1 | 供应商标签开关抽到所有供应商配置页（全局） | **P0 完成**。全局卡与 CLI 详情同宽，不吞引擎页 |
| 2 | 左侧列表显示当前对话供应商标签 | **P0 完成**。八引擎可画；本地 `local`；PI/DSH/Grok 创建不再剥 binding |
| 3 | 切历史会话还原当时独立配置 | **完成**。send 用会话 managed binding；本地不带 leftover picker。vitest 已锁 |
| 4 | 对话中隐藏 `{engine} session` 草稿 | **P0 完成**。当前对话可见；pending / 弱标题隐藏；子会话挂父下 |
| 5 | shared + native 列表从 sqlite 拉全 | **native 读 Index**。Shared 扫目录：**产品确认设计如此，P1 不做** |
| 6 | 列表刷新覆盖、跳动、会话消失 | **完成**。Index `hasMore` / merge 走 unionMembership；权威全量仍可丢掉已删行。vitest 20←12 已锁 |

本轮自伤（切会话拉 catalog 卡死）已拆，**未开 P1**。

剩余：

- **P1 Shared sqlite：取消。** 2026-08-19 产品确认 `list_shared_sessions` 扫目录是设计，不改读源。
- **收口**：tasks 6.x（全量测试 / 手测 archive）；Shared schema 未改则 ADR 不回写

## 基线闸门

- 工作区有另一 AI 未提交 diff（104 文件）。接手只动回归相关文件。
- `session_index/store.rs` 半成品测试有双 `#[test]`，先修再跑 `cargo test session_index`。
- UI 无新视觉组件，不走 HTML 原型闸门（开关只是搬家）。

## 顺序（禁止倒做）

```text
P0-0  修 store.rs 编译 + 吸收半成品（1/2/4 已做部分）
P0-1  问题 3：选会话绑回 provider
P0-2  问题 4：当前对话豁免 + 弱标题隐藏 + 一对一
P0-3  问题 6：importer/hydration 禁止 first-paint 整表
P1-1  问题 5：shared_sessions_v2 补列 + 写入 + backfill
P1-2  问题 5：list_shared_sessions 改读 sqlite
P1-3  问题 1 测试与文案收口
```

P1-1 必须在 P1-2 之前。只改读不改写 = Shared 列表变空。

## P0-0 吸收半成品

保留：

- 全局开关 UI + zh/en 文案
- Index provider 列 / overlay / 前端透传
- pending 不写 Index、remap tombstone、Sidebar filter
- focus-refresh mergeExistingThreads

丢掉：无关 rust 格式化。

## P0-1 选会话绑回

1. `commitThreadSelection` / `handleSelectThread` 带上 `providerProfileId` / `providerProfileName`。
2. Composer execution target 以 **active thread binding** 为准；用户没新选时 send 参数用会话 id，不用全局上次选中。
3. Index merge 已有字段时不得被空 incoming 覆盖（`prev ?? incoming`，半成品已有 id，补 name）。

验证：vitest 切两条不同 provider 的历史会话，picker 与 send payload 跟着变。

## P0-2 占位行

谓词升级：

```text
hide 当且仅当
  不是当前 active thread
  AND（pending id OR 弱标题：{engine} session / Agent N / warmup / 短 hex）
  AND 没有自定义标题
```

一对一：pending→real remap 后立即 tombstone pending；`setThreads` 不得把已 remap 的 pending 再保活成第二条顶层。

`writeClientCreatedSessionIndex`：real id 若还没有真标题，**仍可写账本**（给完整性），但投影按上面 hide。不要靠「不写 Index」藏草稿，否则问题 5 又丢行。

子会话：`parentThreadId` 非空的 native 行继续进树，不升顶层。本谓词只作用于顶层投影。

验证：开新会话 → 侧栏只有当前那一条；切走后若仍是弱标题则隐藏；子 agent 仍挂父下。

## P0-3 刷新不蒸发

1. `session-index-imported`：去掉 `startupHydrationMode: "first-paint"`，只 `mergeExistingThreads`。
2. `listThreadsForWorkspace` merge 路径：Index ∪ 现有 ∪ last-good；禁止用更短页覆盖更长健康列表。
3. tombstone / 用户删除 / 权威空证明仍先于 union。
4. 并发：stale `requestSeq` 不得提交。

验证：hydration vitest 不再要求 imported 事件 early-paint；对话中 mock importer 事件，membership 不减。

## P1 Shared sqlite

### 写

`shared_sessions_v2` additive migration（`SCHEMA_VERSION` 2 → 3）：

- `workspace_id TEXT`
- `title TEXT`

索引：`(workspace_id, updated_at DESC)`。

写入点：

- Shared 创建
- 改标题
- 选 target / engine
- binding native_session_id 变更（已有 `shared_binding_state`）

升级 backfill：一次性从 Shared meta 目录 upsert 进 v2。这是写层，挂 importer / 首次 list 前，**不**挂 first-paint 热路径扫全盘 JSONL。

### 读

`list_shared_sessions(workspace_id)`：

```sql
SELECT session_id, title, selected_target_json, created_at, updated_at
FROM shared_sessions_v2
WHERE workspace_id = ? AND title IS NOT NULL
ORDER BY updated_at DESC
```

`native_thread_ids`：`shared_binding_state` 按 session 聚合。

目录 meta 失败不得让 list 变空（v2 有行就画）。v2 空且 meta 有行：走一次 backfill 再读，禁止永远扫目录当权威。

## 回归闸门

```text
pnpm vitest run \
  src/features/threads/hooks/sessionIndexThreadSummaries.test.ts \
  src/features/vendors/components/VendorSettingsPanel.test.tsx \
  src/app-shell/sections/useWorkspaceThreadListHydration.test.tsx \
  src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx \
  src/app-shell/sections/threadSelect/  \
  src/features/threads/hooks/useThreadActions.native-session-bridges.test.tsx

cargo test session_index -- --nocapture
cargo test overlay_session_index_provider
# Shared list 新测：list_shared_sessions 走 v2
```

手测（Windows 可后置，不挡代码收口）：

- 重启后 managed-provider 标签还在
- 切历史会话独立配置回来
- 对话中无第二条 `{engine} session`
- Shared + native 杀进程后都在

## 回滚

单 change、可整 PR 回退。Shared 读源用 flag 不值得：list 双源会再漏。若 v2 migration 失败，fail closed（现有 event log 打开策略），不要 silently 扫目录假装完整。
