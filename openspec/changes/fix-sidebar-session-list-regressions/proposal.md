# Proposal: fix-sidebar-session-list-regressions

> OpenSpec change id: `fix-sidebar-session-list-regressions`
> 级别：P0 回归收口。吸收未完成的 `restore-native-provider-labels` 与 `stabilize-native-sidebar-during-execution`，并补上那两份没覆盖的绑回 / Shared sqlite / 当前对话豁免。
> Evidence：`docs/analysis/sidebar-session-list-regression-bundle-2026-08-19.md`
> Plan：`docs/plans/2026-08-19-sidebar-session-list-regression-bundle.md`

---

## Why

左侧会话列表在 Index-first 重构后出现六条同源回归：供应商标签开关仍钉在 Codex 页；历史行标签与独立配置切会话后丢失；对话中冒 `{engine} session` / `Agent N` 草稿；Shared + native 列表不完整；刷新整表覆盖导致行蒸发。各自时间线修过，现在一齐冒头。用户要求一次收口。

## What Changes

- 开关「在会话列表显示供应商标签」上移到 CLI 配置内容区顶部全局卡，对所有 CLI 可见。
- Session Index provider 列贯通前端投影；选历史会话 MUST 还原该会话的独立 provider 配置，send 不得用全局上次选中盖账本。
- 顶层一对一：草稿 / 弱标题一律隐藏；**当前正在看的那一条**可见；子会话仍挂父会话，不升顶层。
- Shared 侧栏 list 改读 `shared_sessions_v2`。表不够列则先补写入 + 升级 backfill，禁止继续把目录 walk 当权威。
- importer / focus / hydration 禁止 first-paint 整表替换；membership 只增不减（删除 / tombstone / 权威空除外）。

**非 BREAKING**。不把 Shared 折进 `session_index`，不复活切项目 catalog 扫盘。

## 目标与边界

- **目标**：重启后标签还在；切历史会话独立配置回来；对话中没有第二条占位顶层；Shared 与 native 都能从 sqlite 列出；刷新不再蒸发已画出的行。
- **边界**：侧栏 list / Index / Shared v2 写读 / 选会话绑回。不改 transcript loader、不改 10 分钟 prune 阈值。

## 非目标

- 不把 full catalog / 引擎 disk list 搬回切项目热路径。
- 不把 Shared 行写入 `session_index`。
- 不扩 `resolveEngineProviderLabel` 到未拍板引擎。
- 不提交工作区里无关 rust 格式化。

## Capabilities

### New Capabilities

- `native-sidebar-placeholder-visibility`：顶层一对一；当前对话可见；pending / 弱标题草稿隐藏；子会话挂载不变。
- `shared-sidebar-sqlite-list`：侧栏 Shared 列表权威 = `shared_sessions_v2`；写入必须带 workspace / title；list 不得以目录 walk 为权威。

### Modified Capabilities

- `engine-per-session-provider-binding`：绑定 MUST 从 Session Index 投影为侧栏标签；选会话 MUST 还原独立配置。
- `workspace-sidebar-session-loading`：importer / focus 不得 first-paint 整表；Shared 合并走 sqlite list。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|---|---|---|
| A. 三个 change 并行 | 续跑标签 / 稳定化 / 另开 Shared | 文件必撞 `sessionIndex*` / `useThreadActions*`；正是本轮回归的生产方式 |
| B. Shared 折进 `session_index` | 一张表混 native + shared | 身份重影、hide 更脆；前序已否决 |
| **C. 一个 change + Shared 读 v2（推荐）** | 六条同一合同；v2 补列后 list | 对齐拍板；native / shared 账本分开 |

采用 **C**。

## 验收标准

1. 任意 CLI 配置页能开关供应商标签；Codex 详情页不再重复。
2. managed provider 会话重启后侧栏仍显示对应标签。
3. 切历史会话：composer 回到该会话当时的独立配置；再发送不写到上次全局选中的 home。
4. 新对话过程中无第二条 `{engine} session` / `Agent N` 顶层；当前正在看的那一条即使弱标题也在。
5. 子会话仍挂父下。
6. `list_shared_sessions` 走 `shared_sessions_v2`；杀进程后 v2 里的 Shared 仍出现。
7. importer 事件后已画出的顶层行不得无 tombstone 消失。

## Impact

- Frontend：`VendorSettingsPanel`、`sessionIndex.ts`、`sessionIndexThreadSummaries.ts`、`commitThreadSelection` / layout select、`Sidebar`、`useThreadActions*`、`useWorkspaceThreadListHydration`、`useWorkspaceRefreshOnFocus`、i18n。
- Backend：`session_index/*`、`session_management` overlay、`shared_event_log` schema v3、`shared_sessions::list_shared_sessions`。
- Tests：vitest 投影 / 开关 / 选会话绑回 / hydration merge；Rust Index provider + Shared v2 list。
- Docs：上述 analysis / plan；吸收后删除未跟踪的两个旧 change 目录。
- ADR：Shared v2 schema 增列属于 canonical fact 持久化。收口前核对基石「更新触发器」；命中则回写 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。
