# Tasks: complete-native-sidebar-session-index

> 优先级：P0 止蒸发 → P0 白名单/拆探针 → P1 封读层 → P2 分页 → P3 防再犯。  
> 依赖：`1.*` 完成前禁止 `2.3`（拆 PI 探针）。Shared 本 change 零改。

## 1. P0 投影不蒸发

- [x] 1.1 加强 `normalize_path_key`：收 `\\?\` / `//?/`、统一斜杠、Windows ASCII case-fold。输入：`store.rs`。输出：纯函数 + Rust 单测覆盖 `C:\` / `c:\` / `\\?\C:\`。验证：`cargo test normalize_path_key`。
- [x] 1.2 list 始终等价合并：`list_for_workspace_path` / keyset 不得只在整页为空才走 `paths_equivalent`。输入：`store.rs`。输出：非空 Claude 页仍能带出旧钥匙上的 Grok/PI。验证：Rust 单测「B 页有 Claude + A 页有 Grok → list(B) 含 Grok」。
- [x] 1.3 async writer 超时/error 禁止空 commit：Grok/PI/Gemini/DSH 只标 `partial`，不 `upsert([])`，不把 source 标 fresh。输入：`commands.rs` + `writers.rs`。输出：超时后已有行仍在。验证：Rust 单测人为 timeout 后 list 仍返回旧行。
- [x] 1.4 hide 未就绪不得只画 PI：改用 last-good / 全显。输入：`useThreadActions.ts`。输出：busy timeout 时 Claude/Grok 不闪没。验证：vitest hide-busy 场景。

## 2. P0 写→读闭合与热路径零扫盘

- [x] 2.1 DSH 加入 `INDEX_LIST_ENGINES`。输入：`store.rs`。输出：Index list / keyset 能翻到仅存在于账本的 DSH 行。验证：Rust list 单测含 dsh。依赖：无，可与 1.* 并行。
- [x] 2.2 删除 first-paint DSH 磁盘探针。输入：`useThreadActions.ts`。输出：`startupHydrationMode=first-paint` 零 `listDshSessions`。验证：hydration vitest。依赖：2.1。
- [x] 2.3 删除 first-paint PI 磁盘探针。输入：`useThreadActions.ts`。输出：first-paint 零 `listPiSessions`。验证：hydration vitest。依赖：**1.1 + 1.2 + 1.3**，否则 PI 复制 Grok 蒸发。
- [x] 2.4 `schedulePostFirstPaintFullCatalog` 改名为 Index soft re-sync；确认实现只打 Index，不打 catalog。输入：hydration 调度。输出：符号名与行为一致。验证：hydration 单测 + 代码搜索无日常 full-catalog 暗示。
- [x] 2.5 硬关或删除侧栏 `includeEngineDiskLists` 入口。输入：thread list 选项。输出：Gemini/Grok/Kimi/OpenCode 侧栏路径不再扫盘。验证：默认路径单测；Session 管理页 catalog 仍在。

## 3. P1 封 native 读层

- [x] 3.1 切项目 / focus-refresh / 日常 refresh 强制 first-paint（只读 Index）。输入：`useWorkspaceRefreshOnFocus.ts` 等。输出：focus 不再触发 catalog / disk list。验证：refresh 单测。依赖：2.*。
- [x] 3.2 对照 `native-sidebar-session-index` + `workspace-sidebar-session-loading` delta 补 vitest / Rust 缺口，行为不减。验证：focused vitest + `cargo test session_index`。

## 4. P2 分页

- [x] 4.1 默认露出 N = 首页拉取 N（当前 12）。输入：`useThreadActions.threadList.ts`。输出：不再拉 20 画 5。验证：thread list vitest。
- [x] 4.2 「更多」按 12/24/36/48 提高可见上限，先消耗已拉页，耗尽再发固定 12 条的 `session-index::` keyset；删除「加载更早的」。输入：`Sidebar.tsx` / `ThreadList.tsx`。输出：未展开点更多不 dump 全部，也不先发 IPC。验证：Sidebar / ThreadList vitest。依赖：4.1。
- [x] 4.3 确认 DSH 走同一 keyset，探针 limit 50 路径不存在。验证：代码搜索 + 单测。依赖：2.1 + 4.2。

## 5. P3 防再犯与编排

- [x] 5.1 引擎表 CI 哨兵：sync、backfill 或显式 skip、`INDEX_LIST_ENGINES`、async 超时契约必须齐；Grok/PI 带路径变体单测。输入：新 test/script，接入现有 CI。验证：故意漏 dsh 时哨兵红；当前集合绿。
- [x] 5.2 抽出 native `listThreadsForWorkspace`，Shared merge 不借机重构。输入：`useThreadActions.ts`。输出：文件边界对齐 0.8.9 后续线。验证：行为单测不减。依赖：2.* / 3.* 行为稳定后。

## 6. 验证与文档

- [x] 6.1 跑本 change 触及的 Rust + vitest；`openspec validate complete-native-sidebar-session-index --type change --strict --no-interactive`。
- [ ] 6.2 Windows 手测：同一项目 `C:\` / `c:\` 打开，已有 Grok 行不消失；人为拖慢 grok home 后超时，行仍在。**不 archive 直到手测勾选。**
- [x] 6.3 确认 Shared 侧栏与 hide 与改前一致（回归，不改代码则只手测/现有单测）。
- [x] 6.4 本 change 不命中 ADR 校准触发器；archive 前复核 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 无需回写。
