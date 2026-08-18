# Proposal: restore-sidebar-background-scan-sqlite

> OpenSpec change id: `restore-sidebar-background-scan-sqlite`  
> 现场：ccgui 0.9.1 Windows 测试版2，升级后「最近约 2 小时会话不见」  
> 产品不变量（用户口径）：**不能丢对话。后台必须扫盘，补进 `session_index` SQLite。**  
> 前序（不重做）：`rewrite-sidebar-session-index`、`complete-native-sidebar-session-index`（投影钥匙 / 超时空提交 / 热路径零扫盘）  
> Evidence：`docs/analysis/sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md`

---

## Why

2 层侧栏的写层本应是：磁盘 / CLI 家目录经后台 importer（45s 首拍 / 90s 一拍，sync + cursor backfill）补进 `session_index.sqlite3`，侧栏只读账本。磁盘文件还在、账本没补上、画面用 last-good / 旧 Index 投影，用户就会觉得「对话丢了」。

0.9.1 测试版把 first-paint 收成 Index-only 之后，这条写层必须真的把新会话写进 SQLite。当前 residual：升级 / 杀进程后 first-paint 只信旧账本；importer 可能 fingerprint skip、首拍太晚、encoded-cwd 漏扫；last-good 在 Index 非空但落后时不会把更新的连续性行并回来。这不是物理删盘，也不是 Claude 尾窗 80。

## What Changes

- 固化写层产品不变量：磁盘上仍存在、未被用户删除 / tombstone 的 native 会话，后台扫盘 MUST 在有界周期内 upsert 进 `session_index`。
- 升级 / 冷启 / 异常退出后，importer 首拍 MUST 强制扫（`force=true` 或等价失效 freshness），不得因 8s fingerprint / 旧 `last_sync_ms` 跳过。
- last-good / `sidebarSnapshot` 只做连续性 **floor**（Index 空或 timeout 时别画成空），MUST NOT 当 **ceiling** 盖住 Index 里更新的行，也 MUST NOT 在 Index 非空但缺行时丢掉 last-good 里更新的行。
- `session-index-imported` 补账后侧栏 MUST 重读 Index 并并入新行；不得继续只画升级前 snapshot。
- 本 change **不** 把扫盘搬回 first-paint / 切项目热路径（前序 `complete-native-sidebar-session-index` 已禁）。

**非 BREAKING**。Shared 仍不进 `session_index`。

## 目标与边界

- **目标**：升级 / 杀进程 / 冷启后，磁盘上还在的 native 对话最终出现在 SQLite，再出现在侧栏；用户不必手动 force refresh。
- **边界**：只修 native 写层收敛 + last-good 与 Index 的并集投影。不改 transcript loader、不改 Session 管理 catalog 权威、不把 Shared 折进 Index。

## 非目标

- 不重做 `complete-native-sidebar-session-index` 的路径钥匙 / 超时空提交 / DSH 白名单 / 热路径零扫盘。
- 不复活 first-paint 引擎 disk list。
- 不做 fs watch 实时失效。
- 不把 Shared 写入 `session_index`。
- 不改对话正文加载、Claude 尾窗 80、空会话 prune。
- 不修模型选择器（另 change：`fix-model-picker-send-authority`）。

## Capabilities

### New Capabilities

- `session-index-background-backfill`: 后台扫盘补 SQLite 的合同——升级强制首拍、freshness 不得挡住磁盘更新、upsert 后必须可被 list、失败可观测且不得假装「这个 workspace 扫完了」。

### Modified Capabilities

- `workspace-sidebar-session-loading`: last-good / snapshot 与 Index 的并集规则；importer 事件后必须重读账本，禁止用更旧 snapshot 盖住更新行。

## Impact

- Backend: `session_index/importer.rs`（首拍时机 / 升级 force）、`writers.rs`（freshness vs 磁盘更新）、`commands.rs`（`force` 语义）、必要时 `store.rs` 读 max(updated_at) 对比。
- Frontend: `useThreadActions.ts` last-good 并集、`useWorkspaceThreadListHydration.ts` `session-index-imported` 重读、`sidebarSnapshot` 写入不得把落后 Index 当权威终态。
- Tests: Rust importer / freshness；vitest last-good union + imported 事件刷新。
- Docs: 本 change。分析文只作 evidence。
- ADR：不命中基石更新触发器。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|---|---|---|
| A. first-paint 再扫盘救人 | 恢复 0.8.9 热路径探针 | 否定 2 层；切项目成本回 0.8；与前序硬红线冲突 |
| B. 只加长 last-good TTL | 画面多撑一会儿旧列表 | 账本仍空，升级后最新 2h 永远回不来 |
| **C. 写层必须补账 + last-good 只做 floor（推荐）** | 后台扫盘 upsert SQLite；投影取 Index ∪ 更新的 last-good | 对齐用户口径；热路径仍只读账本 |

采用 **C**。

## 验收标准

1. 磁盘上存在、Index 里没有的 native 会话，冷启后在 importer 首拍（有界，目标 ≤45s，升级后首拍不得再等完整 45s 空转）内写入 SQLite。
2. 升级 / 杀进程后 freshness skip MUST NOT 挡住这批 upsert。
3. last-good 有、Index 非空但缺更新行时，侧栏 MUST 仍能看到 last-good 里那些更新行，直到 writer 确认磁盘已无。
4. Index 已有更新行时，侧栏 MUST NOT 被更旧 snapshot 盖回去。
5. `session-index-imported` upserted>0 后，当前 workspace 侧栏 MUST 出现新行，无需用户点刷新。
6. first-paint / 切项目 / focus-refresh 仍零引擎 disk list。
7. Shared 列表行为不变。
8. 相关 Rust + vitest 绿。不与模型切换 change 打同一个测试包。
