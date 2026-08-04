## Why

`fix-shared-hidden-binding-visibility`（2026-08-03）已把 Grok/Kimi/OpenCode 的 binding
identity 与落盘 id 对齐，但 Shared × Grok 仍**基本必现**泄漏真实 CLI 行：侧栏同时出现
`shared:*` 与同标题的 `grok:*` native 行。根因不再是 identity 分叉，而是 **thread list 异步
refresh 路径使用了创建 Shared 时捕获的 stale `hiddenSharedBindingIds`（常为空）**，在首轮
send materialize binding 之后仍按空 hide set merge native 列表；`mergeGrok` 在 sessions
被滤空时 early-return 原 baseline，已泄漏行无法自清。

## 目标与边界

- 异步 native list refresh（Grok / Kimi / Gemini）在 merge 前 MUST 用**新鲜** Shared list
  重建 hide set，并与 list 开头 hide set 取并集（shared list 失败不得放宽可见性）。
- merge / setThreads 路径 MUST 能从 baseline 剔除 Shared-owned hidden binding，不得只过滤
  新扫到的 session 而保留已泄漏行。
- 行为契约覆盖 Shared 五引擎（Claude / Codex / Kimi / Grok / OpenCode）；本次实现焦点是
  已确认的 Grok 时序洞，并对同构的 Kimi/Gemini 异步路径一并加固。
- 仅改 FE thread list hide 过滤；不改 Shared V2 send 状态机 / identity materialize。

## 非目标

- 不清理历史磁盘 orphan native session（用户可手动删）。
- 不恢复 Gemini Shared 产品能力。
- 不重做 Claude/Codex 主路径 list 架构（二者无 fire-and-forget 异步 refresh 同类洞）。
- 不改用户主动创建的 Native 会话可见性。

## What Changes

- Frontend：`listThreadsForWorkspace` 异步 Grok/Kimi/Gemini refresh 重建 hide set
  （fresh Shared list ∪ outer hide set），并在 `listSharedSessions` 后再校验 `requestSeq`。
- Frontend：`stripHiddenSharedBindingSummaries` + `mergeNativeCliSessionSummaries` 对
  baseline 与 sessions 双向剔除 hidden id；禁止 sessions 为空时 early-return 原 base。
- Frontend：主路径 `setThreads` 前 final hide 闸门。
- Tests：async race（create 时空 hide → mid-flight binding materialize 仍 hide）；
  merge baseline purge；strip helper。
- Specs：`shared-session-thread` 增补「hide set 不得 stale」与跨引擎 list 路径要求。

### 方案对比与取舍

| 方案 | 说明 | 取舍 |
|------|------|------|
| **A. 仅刷新 Grok hide set** | 最小 diff | 拒绝：Kimi/Gemini 同构异步路径会复发 |
| **B. 取消异步 refresh，全部同步 list** | 消除 stale 闭包 | 拒绝：拖慢首屏，且 Claude/Codex 主路径已同步 |
| **C. 异步重建 hide + baseline strip + final gate（采用）** | 与 identity 修复正交，防御多层 | **采用**：修根因且覆盖同构引擎 |

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-thread`：明确 thread list / async refresh 的 hide set 新鲜度与 baseline
  purge 契约；补跨引擎路径矩阵（哪些引擎走同步/异步 list）。

## Impact

- Frontend：`useThreadActions.ts`、`useThreadActions.helpers.ts` 及 focused Vitest。
- Specs：`openspec/specs/shared-session-thread` delta。
- 无 IPC / schema / Rust 变更。
- 依赖：无新增依赖。

## 跨引擎审查摘要（详见 design）

| Engine | List 路径 | 是否存在同类 stale hide 洞 | 本次处置 |
|--------|-----------|---------------------------|----------|
| **Grok** | 异步 fire-and-forget refresh | **是（已复现）** | 修复 |
| **Kimi** | 同构异步 refresh | **是（同构）** | 一并修复 |
| **Gemini** | 同构异步 refresh | 理论同构（Shared 已退役） | 防御性修复 |
| **Claude** | 主路径同步 `Promise.allSettled` + per-id hide | 否（同源 hide set） | 仅 final strip 加固 |
| **Codex** | 主路径 catalog 同步 filter | 否 | 仅 final strip 加固 |
| **OpenCode** | 主路径同步 merge + hide | 否 | 仅 final strip 加固 |

## 验收标准

- Shared × Grok 创建后首轮发送：侧栏仅 `shared:*`，无同标题 `grok:*`。
- 异步 refresh 中途 binding materialize：focused race 测试通过。
- baseline 已泄漏 hidden id：merge/final strip 后从列表消失。
- Shared × Kimi 同契约；Claude/Codex/OpenCode hide 无回归。
- `openspec validate fix-shared-sidebar-hide-set-staleness --strict` 通过。
- focused Vitest 通过；**不强制**全量 suite。
