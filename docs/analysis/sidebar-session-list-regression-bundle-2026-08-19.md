---
type: analysis
status: active
created: 2026-08-19
product_line: 0.9.1
branch: bump-version-0.9.1
---

# 左侧 Session 六条回归：定位与接手口径

> **Lifecycle**: active。这是 2026-08-19 的代码事实与决策记录，不是 OpenSpec 合同。
>
> 合同将落在 `openspec/changes/fix-sidebar-session-list-regressions/`。
>
> 前序对照：[`sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md`](./sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md)。
> 相关未收口 change：`restore-native-provider-labels`、`stabilize-native-sidebar-during-execution`、`complete-native-sidebar-session-index`、`restore-sidebar-background-scan-sqlite`。

## 0. 产品拍板（2026-08-19）

| 议题 | 决定 |
|---|---|
| 范围 | **六条一起改**，不再拆并行 PR |
| Shared 读源 | 侧栏 Shared 列表 MUST 读 `shared_sessions_v2`。写入不够就先补写入，禁止继续把目录 walk 当权威 |
| 占位行 | 当前正在看的那一条对话可见。草稿 / `{engine} session` / `Agent N` 一律隐藏 |
| 树形 | 一个对话 = 一个顶层。子会话逻辑不变，仍挂在父会话下（native CLI / Shared 子树） |

接手原则：工作区里另一路 AI 已改了一批相关文件，也夹了大量无关 rust 格式化。**只收六条回归相关 diff，不提交无关文件。**

切会话卡死（本轮自伤，2026-08-19 已拆）：补标签后每条会话都有 `providerProfileId`，点击路径 `refreshEngineModels` → `get_engine_models`（on-demand ≤8s）。规则：[`dev-guidelines/guides/session-switch-catalog-fetch-pitfall.md`](../../dev-guidelines/guides/session-switch-catalog-fetch-pitfall.md)。

---

## 1. 一句话

侧栏重构把 catalog 宇宙收成「读 = SQLite，写 = 后台扫盘」之后，标签、绑回、草稿、完整性、刷新分别补过。现在断在 **前端投影丢字段、选会话不绑回 provider、占位行写入仍在、Shared 仍扫目录、importer 仍整表 setThreads**。

不是六套新 bug，是同一条读层收口没做完。

---

## 2. 总表

| # | 现象 | 2026-08-19 HEAD 口径 | 工作区半成品 | 还缺什么 |
|---|---|---|---|---|
| 1 | 供应商标签开关应全局 | 仍只在 Codex CLI 详情页 | **已上移**到 `VendorSettingsPanel` 内容区顶部 | 测试仍写「从 Codex tab 打开」；其余 locale 文案未齐 |
| 2 | 列表不显示当前会话供应商 | SQLite 有列、list 有 overlay，`sessionIndexRowsToThreadSummaries` 不拷贝 | **前端已透传** `providerProfileId/Name`；创建行可写 binding | 切会话后 composer 仍可能空；非 Codex writer 仍写 `None`，靠 overlay |
| 3 | 切历史会话不还原独立配置 | `commitThreadSelection` 只 `setActiveEngine` | **未做** | 选会话必须带上 `providerProfileId`；send 不得用全局 picker 盖账本 |
| 4 | 对话时冒 `{engine} session` 草稿 | pending id 会藏；real id 仍写入占位标题 | pending skip + Sidebar filter + remap tombstone | 当前对话豁免；`Agent N` 也要藏；停止用 `{engine} session` 当可见标题 |
| 5 | Shared + native 列表不完整 | Native 读 `session_index`（首页 12）；Shared 扫目录 | **未做 Shared sqlite 读** | `shared_sessions_v2` 缺 `workspace_id` / `title`，必须先补写入再改 list |
| 6 | 列表刷新覆盖、跳动、消失 | `setThreads` 有 noop，importer 仍 first-paint 紧急整表 | focus-refresh 已改 merge | importer / hydration 禁止 first-paint 整表；membership 只增不减（删除 / tombstone 除外） |

---

## 3. 证据链

### 3.1 开关（问题 1）

- 设置值：`appSettings.showSidebarProviderLabels`，ThreadList / PinnedThreadList 已吃全局 flag。
- UI 原位置：`VendorSettingsPanel` Codex 分支。
- 半成品：开关已挪到返回 CLI 列表按钮下方的「全局设置」卡；zh / en 文案去 Codex。
- 测试：`VendorSettingsPanel.test.tsx` 仍断言 `toggles sidebar provider labels from the Codex provider tab`。

### 3.2 标签投影（问题 2）

后端（半成品已落地）：

- `session_index` DDL + ALTER：`provider_profile_id` / `provider_profile_name`
- upsert `COALESCE`，不知道 provider 的 writer 不得清空
- Codex writer 从 provider-home 路径推断
- `list_session_index_for_workspace` 调 `overlay_session_index_provider_bindings`（绑定账本 + Codex physical_path 兜底）

前端断点（半成品已补投影）：

- `SessionIndexRow` 增加两列
- `sessionIndexRowsToThreadSummaries` 拷到 `ThreadSummary`
- `writeClientCreatedSessionIndex` 可带 binding；**pending id 不再写入**

`resolveEngineProviderLabel` 仍只对 claude / codex / grok / kimi / opencode 出标签。pi / dsh / gemini 有 binding 也不会画。本轮不扩引擎集合，除非 overlay 已给出 name。

### 3.3 切会话绑回（问题 3）— 接手主缺口

```text
handleSelectThread
  → commitThreadSelection
      → setActiveThreadId
      → setActiveEngine(engineSource)   // 只切引擎
```

Composer：

```text
providerProfileId={activeThreadSummary?.providerProfileId ?? null}
```

后端 send 优先级：

```text
请求参数 providerProfileId  >  catalog 绑定账本  >  default
```

因此：Index 没带上字段 → picker 显示全局当前供应商 → send 把错误 id 带下去 → **盖掉**该会话当时的独立配置。

修复必须同时做：

1. ThreadSummary 有字段（问题 2）
2. 选会话把该字段设进 picker / execution target
3. 该会话 send 若用户没有新选供应商，请求参数必须用会话 binding，禁止用「上次全局选中」

### 3.4 草稿隐藏（问题 4）

已有谓词 `shouldHidePlaceholderNativeDraftFromSidebar`：

- pending id `{engine}-pending-{millis}-{nonce}` → 藏
- 标题匹配 `{engine} session` / `DeepSeek Harness Session` → 藏
- 自定义标题豁免

漏：

| 路径 | 结果 |
|---|---|
| `writeClientCreatedSessionIndex` 对 **real** id 默认 title = `` `${engine} session` `` | Index 出现占位行 |
| `ensureThread` 非 `claude:` id 默认名 `Agent ${n}` | remap 后 pending hide 失效，`Agent N` 露出 |
| `setThreads` 保活 **active** 线程 | 对话中那条占位行被硬保回来 |

拍板后的口径：

```text
顶层可见行 = 真对话（有强标题，或当前 active）
隐藏 = pending 草稿 + 弱标题（{engine} session / Agent N / warmup / 短 hex）
例外 = 当前正在看的那一条，即使标题还弱，也必须占一个顶层槽
一对一 = 同一对话不得同时出现 pending + real 两条顶层
子会话 = 仍挂 parentThreadId / Shared 子树，本 change 不改挂载
```

### 3.5 列表完整性（问题 5）

Native 设计仍是：

```text
磁盘 / CLI home --importer--> session_index.sqlite3 --list--> 侧栏 native
```

首页 limit = 12，更老靠 keyset。「更多」先消耗已拉页。Windows 路径钥匙 / 超时空提交代码已勾，手测未勾。

Shared **现在不是 sqlite**：

- `list_shared_sessions` → `list_workspace_shared_sessions` 扫 workspace Shared **目录**
- hide 依赖这次 list 的 `nativeThreadIds`
- first-paint 在 Index 早画后仍 `await listSharedSessions`；超时 = 新 Shared 进不来

`shared_sessions_v2` 当前 schema：

```text
session_id PK
schema_version
next_sequence
selected_target_json
created_at
updated_at
```

**没有 `workspace_id`，没有 `title`。** 只读这张表画不出侧栏。`shared_binding_state` 有 `native_session_id`，可做 hide，但仍缺 workspace 过滤和标题。

因此问题 5 的正确顺序是：

1. 给 `shared_sessions_v2` 增加 list 所需列（至少 `workspace_id`、`title`），migration 单调 +1
2. create / rename / 选 target / binding 变更时同步写入
3. 冷启 / 升级 backfill：扫现有 Shared meta 目录，upsert 进 v2（一次性写层补账，不是侧栏热路径扫盘）
4. `list_shared_sessions` 改为 `SELECT` v2（按 workspace），`native_thread_ids` 从 `shared_binding_state` 聚
5. 目录 meta 仍服务 load transcript / 旧客户端，不再当侧栏权威

不把 Shared 折进 `session_index`（避免和 native 重影）。Native 继续只读 `session_index`。

### 3.6 跳动 / 蒸发（问题 6）

`setThreads` 末尾有 `threadSummaryListEqual` noop。仍跳是因为 **incoming 经常真的改了 membership**。

| 触发 | 现码 | 半成品 |
|---|---|---|
| `session-index-imported` | `startupHydrationMode: "first-paint"` + merge → 紧急最终 `setThreads` | 未改 |
| focus-refresh | 曾 first-paint | 已改 `mergeExistingThreads` + 关 OpenCode fan-out |
| 首页 12 条替换更长内存列表 | last-good 并集补洞，不全则蒸发 | 未改 membership 只增 |
| Shared hide 从空到齐 | native 先滤后补 | 未改 |

并发：切项目 / focus / importer / 发送后 refresh 抢 `requestSeq`，后到的 partial 页盖先到的完整页。

---

## 4. 因果，不是六条平行 bug

```text
开关仍在 Codex 页 ──半成品已上移──► 问题 1（收测试）
Index 有列，投影曾丢掉 ──半成品已透传──► 问题 2
        └─ 选会话不绑回 provider ──────────► 问题 3（主缺口）

real id 写入 "{engine} session"
pending remap 后 Agent N + active 保活 ──► 问题 4（差当前对话豁免）

Native 读 session_index / Shared 扫目录 ──► 问题 5（先补 v2 写入）
importer first-paint 整表 setThreads ──► 问题 6（放大 4、5）
```

---

## 5. 工作区半成品（另一 AI，未提交）

相关、可接手：

- `src/services/tauri/sessionIndex.ts`
- `src/features/threads/hooks/sessionIndexThreadSummaries.ts` (+ test)
- `src/features/threads/hooks/useThreadActionsSessionRuntime.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`
- `src/features/app/components/Sidebar.tsx`
- `src/features/vendors/components/VendorSettingsPanel.tsx`
- `src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts` (+ test)
- `src/i18n/locales/{zh,zh-TW,en}/settings.ts`（其余 locale 只加了 `globalSettings` key）
- `src-tauri/src/session_index/{store,commands,writers,empty_prune,shared_visibility}.rs`
- `src-tauri/src/session_management.rs` + provider binding tests
- 未跟踪：`openspec/changes/restore-native-provider-labels/`
- 未跟踪：`openspec/changes/stabilize-native-sidebar-during-execution/`

不要收进本 change 的脏文件：`agent_orchestration/**`、`coding_plan_quota/**`、`note_cards/**`、`pi_auth.rs`、`dsh/**`、wallpaper / update generated 等。那是另一路格式化或无关工作。

已知半成品缺陷：

- `store.rs` 测试出现连续两个 `#[test]`，会编不过，接手时先修
- `restore-native-provider-labels` tasks 仍全未勾，但代码已做一截
- 两个旧 change **不覆盖** 问题 3 / 5，也不覆盖「当前对话可见」口径

统一收口 change id：`fix-sidebar-session-list-regressions`。那两个未跟踪 change 吸收进来后删除，避免三份合同并行。

---

## 6. 验收口径（给实现 / 手测）

1. 任意 CLI 配置页顶部能开关「在会话列表显示供应商标签」；Codex 详情页不再重复。
2. 用 managed provider 建 Claude / Codex / Grok 会话，重启后侧栏仍显示该供应商标签。
3. 切到另一条历史会话：composer 独立配置回到该会话当时的 provider，再发送不会写到「上次全局选中」的 home。
4. 新开对话过程中：pending / `{engine} session` / `Agent N` 不出现第二条顶层；**当前正在看的那一条**即使还没正式标题也在。
5. 子会话仍挂在父会话下，不升顶层。
6. Shared 侧栏行来自 `shared_sessions_v2` 查询，不依赖 first-paint 扫目录成功。杀进程后磁盘 / v2 里还在的 Shared 必须回来。
7. 对话进行中 importer / focus 不得整表闪；已画出的顶层行不得无 tombstone 消失。

---

## 7. 非目标

- 不把 full catalog / 引擎 disk list 搬回切项目热路径
- 不把 Shared 写入 `session_index`
- 不改 transcript loader
- 不改 10 分钟 stale-empty prune 阈值
- 不扩 `resolveEngineProviderLabel` 到未拍板引擎
- 不提交工作区里无关 rust 格式化
