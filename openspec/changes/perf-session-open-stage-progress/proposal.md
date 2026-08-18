# Proposal: perf-session-open-stage-progress

> OpenSpec change id: `perf-session-open-stage-progress`  
> Skill: `openspec-ff-change`  
> Evidence: 本地超大会话（约 6000 条 / DSH host 最多 40 页 × 200 message）打开仍卡 ~15s；幕布只有「正在加载对话窗口…」，无法判断卡在 host 拉页、parse、hydrate 还是首屏 mount  
> 邻近 change（禁止混进本 diff）：`perf-large-transcript-first-paint`、`fix-claude-history-disk-window-load-more`、`fix-shared-history-projection-nonblocking`

---

## Why

首屏 / 芯片 / 上翻视口已经拆开，打开仍要等整段 `load()`。Shared 有阶段百分比，Native / DSH / Claude 只有布尔幕布。15 秒卡在哪，用户和开发都看不见。先把打开过程做成可诊断的阶段进度，再决定要不要做 DSH tail-first IPC。看不见卡点就继续改常量，是拆东墙补西墙。

## What Changes

- Native / DSH / Claude 打开复用现有 `HistoryLoadingProgress` + spine，不再发明第二套进度模型。
- 幕布在 `progress != null` 时展示阶段名 + 百分比 + 当前细节（页号 / 条数），不再把 spine 锁死成 Shared-only。
- DSH `load_dsh_session` 每拉完一页 host `session.history` 就 emit 进度事件；JS 在 IPC 返回前就能看到「第 N / 40 页」。
- JS 侧在 parse / hydrate / finalize 之间让出一帧，让阶段文案能画出来。
- `setThreadHistoryLoadingProgress` 比较必须包含 `detailParams`，否则「第 3 页」和「第 4 页」同 percent 会被吞掉。
- 本 change **不**把 DSH 改成 tail-first IPC。那是下一刀；本刀只让 15 秒变得可定位。

## 目标与边界

- **目标**：打开超大会话时，幕布能回答「现在卡在哪」；DSH 拉页期间百分比会动。
- **边界**：打开路径的进度合同（Rust 页事件、JS 阶段、幕布 spine、equality）。不改 hydrate 算法、不改 800/300/80、不改芯片翻页。
- **引擎**：DSH 有页级事件；Claude / Grok / Kimi / Pi 至少有 JS 阶段（prepare → session → parse → hydrate）；Shared 保持现有阶段，不被本 change 改口径。

## 非目标

- 不重开时间线虚拟化 / 行级 lightweight 墙。
- 不做 DSH tail-first IPC（幕布等完最新一页就卸）。那是独立 change。
- 不把 800/300/80 再拧一遍。
- 不用固定 timeout 当卡顿修复。
- 不在 AppShell 根链新挂进度 setState；走现有 `historyLoadingProgressByThreadId`。
- 不改今天的 hasMore / 空 assistant / Shared V0 接线。
- 不承诺 remote `load_dsh_session` 也有页事件（远程桥接另跟）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|------|------|------|
| **A. 复用 Shared spine + DSH 页事件（采用）** | 同一 `HistoryLoadingProgress`；Rust emit 页事实；JS 映射阶段 | 不造第二套 UI；15 秒里能动的是真页号 |
| B. 只改文案，不 emit | 打开时写死「正在拉取历史…」 | 15 秒全程停在同一句，诊断为零 |
| C. 立刻做 DSH tail-first | 最新一页先返回、幕布卸、后台翻旧页 | 这才是砍 15 秒的刀；没有阶段可见性，验收会把「快了」和「还卡在 fold」混在一起 |
| D. 重开虚拟化当打开优化 | 行级回收 | 合同红线；和 stick-to-bottom 打架 |

## Capabilities

### New Capabilities

- `session-open-stage-progress`：会话打开幕布必须报告具名阶段和百分比；DSH host 拉页必须在 IPC 返回前把页进度送到画布。

### Modified Capabilities

- （无）`conversation-curtain-assembly-core` 仍是装配合同；本 change 补的是它没写的打开诊断进度。

## Impact

- `src-tauri/src/engine/dsh/history.rs`：`load_dsh_session` 可回调每页进度。
- `src-tauri/src/engine/session_history_commands.rs`：本地 `load_dsh_session` emit `dsh-history-load-progress`。
- `src/services/events.ts`：订阅该事件。
- `src/features/threads/utils/historyLoadingProgress.ts` + 新 native builder：Native / DSH 阶段。
- `HistoryLoadingSurface` / spine：`progress != null` 即出阶段条。
- `useThreadHistoryLoadingState`：equality 含 `detailParams`。
- `useThreads.ts` / `useThreadActionsResumeThread.ts`：选中即 prepare；DSH 听页事件；parse/hydrate 报阶段。
- i18n：`zh` / `en` 增加 Native 阶段文案。
- 测试：builder、equality、surface、event hub、resume 阶段顺序。

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| A | Native / DSH 打开幕布不再只有 indeterminate 爬行灯；有阶段名和 percent | surface 单测 + 本地手测 |
| B | DSH 拉第 N 页时细节含页号，且第 N 页和第 N+1 页都会更新 | mapper + equality 单测 |
| C | Shared 现有 prepare/session/projection/merge 文案和 percent 不被改坏 | 现有 Shared surface / loader 单测仍绿 |
| D | 进度走现有 `historyLoadingProgressByThreadId`，不新增 AppShell root state | domain key 无新增 |
| E | 虚拟化仍关；800/300/80 不变 | 常数 / 虚拟化守卫 |
| F | 不用 timeout 假装打开完成 | 代码审查：yield 只为画阶段，不卸幕布 |
