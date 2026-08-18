# Proposal: complete-native-sidebar-session-index

> OpenSpec change id: `complete-native-sidebar-session-index`  
> 前序：`rewrite-sidebar-session-index`（2 层骨架：读 = SQLite；写 = 后台扫盘 + 游标）  
> Evidence：`docs/analysis/sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md`

---

## Why

`rewrite-sidebar-session-index` 把侧栏从「每次切项目扫会话宇宙」收成 2 层，但 **读层钥匙、写失败语义、引擎白名单、热路径探针** 没有闭环。结果是：磁盘文件还在、`session_index` 行还在，Windows 上 native Grok（PI 同族）却从侧栏蒸发；DSH 能写入却进不了 list；first-paint 仍扫 DSH/PI 盘。本 change 补上那句漏掉的产品不变量：**native 行一旦入账，不得从侧栏蒸发。**

## What Changes

- 读层 workspace 钥匙稳定：`normalize_path_key` 收 Windows `\\?\` / 盘符大小写；list 不得只在「整页为空」才走 `paths_equivalent`。
- 写超时 / 扫空不得空 commit：Gemini / Grok / PI / DSH 的 3s timeout 只标 `partial`，已有行保留。
- hide 未就绪不得抹 native：去掉「只画 PI」；busy 用 last-good / 全显。
- DSH 进入 `INDEX_LIST_ENGINES`，与 PI/Gemini 同一套 list / keyset。
- first-paint / 切项目 / focus-refresh 热路径零 `listDshSessions` / `listPiSessions` / 各引擎 disk list。
- 侧栏不再接受 `includeEngineDiskLists`；`schedulePostFirstPaintFullCatalog` 改名为 Index soft re-sync。
- 分页：露出 N = 首页拉取 N；「更多」先消耗已拉页，再 `session-index::` keyset。
- 引擎表 CI 哨兵：sync + backfill（或显式 skip）+ `INDEX_LIST_ENGINES` + 前端投影 + 路径键/超时契约必须齐。
- 抽出 native `listThreadsForWorkspace` 编排，行为单测不减。

**非 BREAKING**：Shared 维持独立 list + Index 带 hide（option B）；transcript loader 与会话管理 catalog 不改权威。

## 目标与边界

- **目标**：侧栏 native 只读 Session Index；扫盘只在后台按周期 + 游标回写；已入账 native 行在路径变体 / 写超时 / hide 未就绪下仍可列出。
- **边界**：只改 native 侧栏 list 的写→读投影。Shared 本 change 不改身份与数据源。catalog 仍服务 Session 管理页 / 显式 force。

## 非目标

- 不把 Shared 折进 `session_index`（不选 option A）。
- 不复活 sidebar rail / 不把 catalog 搬回切项目热路径。
- 不用 timeout 冒充列表 ready；不靠 first-paint 再扫 Grok/PI 盘「救」列表。
- 不做侧栏搜索 / 按引擎过滤。
- 不为 OpenCode 补 exhaustive 历史 cursor。
- 不做 fs watch 实时失效（仍属前序 still-open）。
- 不改对话 transcript 加载语义。

## Capabilities

### New Capabilities

- `native-sidebar-session-index`: native 侧栏 2 层闭环合同——唯一读源、后台写、路径钥匙、超时空提交禁令、引擎白名单、分页露出、CI 哨兵。

### Modified Capabilities

- `workspace-sidebar-session-loading`: first-paint / 切项目 / focus-refresh 只读 Index；禁止 DSH/PI 磁盘探针；hide 未就绪不得剥离已入账 native。

## Impact

- Backend: `session_index/store.rs`（`normalize_path_key` / `paths_equivalent` / `list_for_workspace_path` / `INDEX_LIST_ENGINES`）、`session_index/commands.rs`（async timeout commit）、`session_index/writers.rs`（`commit_engine_rows`）。
- Frontend: `useThreadActions.ts` first-paint 探针与 hide 降级、`useThreadActions.threadList.ts` 露出条数、`useThreadActionsLoadOlder.ts`、「更多」语义、`schedulePostFirstPaintFullCatalog` 改名、`includeEngineDiskLists` 硬关。
- Tests: Rust path-key / timeout-commit；vitest first-paint 零探针、hide last-good、分页露出。
- Docs: 本 change；分析文 `docs/analysis/sidebar-session-list-fetch-0.8.9-vs-current-2026-08-18.md` 作 evidence，不升格为合同。
- ADR：不命中基石更新触发器（不改 engine registry / Shared 支持集合 / provider binding / canonical fact schema）。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 只给 Grok 打 Windows 补丁 | 扩 encoded-cwd 变体 + 加长 timeout | 快，但 PI/Gemini/DSH 同构漏洞还在；拆探针后 PI 立刻变成第二个 Grok |
| B. 侧栏再扫 Grok/PI 盘救人 | first-paint 给 Grok 也加探针 | 直接否定 2 层；切项目成本回到 0.8 |
| **C. 补闭环不变量（推荐）** | 钥匙稳定 + 超时空提交禁止 + hide 不抹 + 白名单 + 热路径零扫盘 + 分页对齐 | 一次收口本轮所有现场；Shared 不动 |

采用 **C**。

## 验收标准

1. 同一 Windows 项目用 `C:\` / `c:\` / `\\?\C:\` 打开，已入账 Grok / PI 行都在侧栏。
2. 人为让 `list_grok_sessions` 超时：侧栏已有 Grok 行不消失；partial 可观测。
3. hide store 200ms busy：Claude / Grok 不闪没；不再「只画 PI」。
4. 冷启 / 「更多」能翻到只存在于 Index 的 DSH 行。
5. `startupHydrationMode=first-paint` 下零 `listDshSessions` / `listPiSessions` / 各引擎 disk list。
6. 未展开点「更多」：先画完已拉页，不够再 keyset；默认露出条数 = 首页拉取条数。
7. 新引擎 CI 哨兵：缺 `INDEX_LIST_ENGINES` 或缺超时契约则失败。
8. Shared 列表与 hide 行为与本 change 前一致。
