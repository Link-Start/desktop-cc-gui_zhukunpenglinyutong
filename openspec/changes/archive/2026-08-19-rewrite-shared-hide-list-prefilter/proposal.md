## Why

`fix-shared-codex-sidebar-hide-alias` 只重写了 hide **判定核**（expand / pup / final strip）。`useThreadActions` list orchestrator 的 **ingest 预过滤** 仍是 exact `Set.has` 或 first-colon 剥离。first-paint 跳过 catalog 时，live Codex `listThreads` 会把 `rollout-*-{uuid}` 插进 merge map；catalog 预过滤对无冒号 stem 失效。final strip 能补救 owner 行，但预过滤与判定核合同不一致，Windows Shared 下崽会在中间态漏成根。

本变更**不合并**进 hide-alias。按「预过滤必须与判定核同一 identity」重写 ingest 闸门，不搬 0.8.9 colon-split / fail-closed。

## 目标与边界

### 目标

| ID | 目标 | 可测定义 |
|----|------|----------|
| G1 | list ingest 预过滤与 hide identity 同一合同 | live Codex / Claude / OpenCode / catalog / continuity / engine cache / 异步 refresh 预过滤，对 `uuid` ↔ `codex:uuid` ↔ `rollout-*-{uuid}` 的判定与 `threadIdInHiddenSharedBindingSet` 一致 |
| G2 | 删除 first-colon hide 预过滤 | catalog 路径 MUST NOT 再用 `indexOf(":")` / `slice` 当 hide matcher |
| G3 | 路径形 id 不误伤 | `S:\…` / UNC / `\\?\` / `/Users` / `/home` 不得因冒号或前导 `/` 被预过滤误藏或误剥 |
| G4 | 引擎行 id 用最终侧栏 id 做 candidate | `claude:` / `opencode:` / `kimi:` / `grok:` / `pi:` / `gemini:` / `dsh:` 预过滤传入带前缀的行 id，禁止只拿 bare 去撞 hide set |

### 边界

- 仅 Frontend list orchestrator 预过滤：`useThreadActions.ts` 内所有 Shared hide `.has` / first-colon 闸门。
- 判定核继续用已落地的 `threadIdInHiddenSharedBindingSet` / `sharedHideIdentityIntersects`。禁止再写一套 matcher。

## 非目标

| 项 | 原因 |
|----|------|
| 并入 `fix-shared-codex-sidebar-hide-alias` | 用户明确禁止合并；判定核与 ingest 闸门分 change |
| 搬 0.8.9 empty-hide fail-closed | 0.9.1 hide-unreadiness 有意 last-good / full-show，回退会蒸发 Windows Grok |
| 搬 first-colon / last-colon 当 matcher | Windows 盘符土地雷；正是本轮要删的规则 |
| 按「Base directory…」标题藏行 | 无 parent 时宁漏勿误伤 |
| 改 Rust `push_id` / `session_id_aliases` / visibility lock | visibility 写入的是 session id；无路径 id 进 V0/V2 的证据 |
| 给 DSH / Gemini 补 hide engine 前缀表 | 不是 Shared Codex 下崽合同；DSH 不是 Shared hide prefix |
| 首屏尚无 Shared 行的时序 hide | hide-alias 已标非目标；本轮不堵 title-hide |

## What Changes

- 新增 capability：list ingest 预过滤 MUST 走 Shared hide identity，MUST NOT 使用 exact `Set.has` 或 first-colon。
- 重写 `useThreadActions.ts` 全部 Shared hide 预过滤位点，统一调用 `threadIdInHiddenSharedBindingSet`。
- 删除 catalog 预过滤里的 first-colon IIFE。
- 单测覆盖：live/catalog 形态的 rollout stem 在 uuid-only hide set 下被预过滤丢掉；Windows / POSIX 路径不被 colon 规则误伤。

## 技术方案对比与取舍

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 把 0.8.9 first-colon 补进预过滤 | 与 hide-alias 合同冲突；盘符 `S:\` 会被剥 | **拒绝** |
| B. 只靠 1880 final strip，预过滤维持 exact `.has` | first-paint live Codex 仍把 stem 写入 merge map，中间态泄漏 | **拒绝** |
| **C. 预过滤重写为同一 identity 函数（采用）** | 不新造 matcher；candidate 用最终行 id | **采用** |

## Capabilities

### New Capabilities

- `shared-hide-list-prefilter`：侧栏 thread-list ingest 预过滤与 Shared hide identity 必须同一合同；禁止 exact Set 与 first-colon。

### Modified Capabilities

无。不把本要求写进 `subagent-session-tree-navigation`，避免与 hide-alias delta 合并。

## Impact

| 层 | 触点 |
|---|---|
| Frontend | `src/features/threads/hooks/useThreadActions.ts` 预过滤；`useThreadActions.helpers.ts` 仅复用既有 `threadIdInHiddenSharedBindingSet` |
| Tests | helpers / identity 单测补 ingest 合同 |
| Specs | 新 capability `shared-hide-list-prefilter` |
| 无 | Rust `push_id`、visibility SQLite、hide-unreadiness、Session Index writer |

## 验收标准

1. hide set 仅有 `{uuid}` / `codex:{uuid}` 时，live Codex 行 id 为 `rollout-*-{uuid}` MUST 在 ingest 预过滤被丢，不得进入 merge map。
2. catalog `sessionId` 为 stem 或 `codex:stem` 时，同一 hide set MUST 丢行；实现中 MUST NOT 再出现 hide 用的 `indexOf(":")`。
3. Claude / OpenCode / continuity / Gemini / Kimi / Grok / Pi / DSH 预过滤传入带引擎前缀的 candidate，uuid-only hide set 仍能丢对应 owner。
4. `S:\AIWorker\…`、UNC、`/Users/…`、`/home/…` MUST NOT 被预过滤误藏。
5. hide-unreadiness last-good / full-show 行为不变。
6. focused Vitest + `openspec validate rewrite-shared-hide-list-prefilter --strict` 通过。
7. **不自动 commit**。
