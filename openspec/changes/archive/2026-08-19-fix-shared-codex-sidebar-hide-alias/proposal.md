## Why

Shared CLI × Codex 在 Windows 上把子代理（Socrates / Singer 等）和 hidden native owner（`Base directory…`）漏成侧栏根节点，把当前 Shared 会话挤进「更多…」。根因不是 parent 没写上，而是 hide / pup 判定只认 `uuid` / `codex:uuid`，不认 Codex live 常用的 `rollout-TIMESTAMP-uuid`；同时 `id.includes(":")` 会把 Windows 盘符当成 engine 前缀剥掉。

## 目标与边界

### 目标

| ID | 目标 | 可测定义 |
|----|------|----------|
| G1 | Codex canonical uuid 与 `rollout-*-{uuid}` 互认 | binding / hide set 为 uuid 或 `codex:uuid`，live / parent 为 rollout stem（或反过来）→ owner 被 strip、崽被侧栏隐藏 |
| G2 | Win / Mac / Linux 路径不当 engine 前缀 | `S:\…`、`\\?\C:\…`、UNC、`/Users/…`、`/home/…` MUST NOT 被 `indexOf(":")` / `includes(":")` 剥成假 raw id |
| G3 | 不猜标题、不发明时间戳 | 无 authoritative parent 仍不藏；expand MUST NOT 凭空生成 `rollout-时间戳` |
| G4 | 普通 native 父子零回归 | parent 不在 Shared hide set 时，Win/Mac/Linux 的 native 树仍可见 |

### 边界

- Frontend hide identity：`expandHiddenSharedBindingIds`、`lookupSharedOwnerByNativeParent`、`isSharedSidebarHiddenPup`、`threadIdInHiddenSharedBindingSet`。
- 不改 Rust catalog / binding materialize / Session Index writer。

## 非目标

| 项 | 原因 |
|----|------|
| 按「Base directory…」标题藏行 | 无 parent 时宁漏勿误伤 |
| 后端补 `session_id_aliases` 进 Shared list | FE 抽 uuid 即可闭环 |
| 首屏无 Shared 行的时序 hide | 全量 list 对齐 alias 后即可；时序另案 |
| 改 visibility SQLite lock / busy_timeout | 放大器，不是 durable 根因 |

## What Changes

- 新增 Shared hide identity helper：只剥 **已知 engine 前缀**；从 Codex rollout stem 抽尾部 uuid；路径形 id 原样保留。
- hide set / pup 判定 / owner strip 共用该 identity，使 uuid ↔ `codex:uuid` ↔ `rollout-*-{uuid}` 互认。
- 单测按 Win / Mac / Linux 分组：盘符与 POSIX 路径不误剥；rollout alias 在三端 id 形态下都能藏崽、strip owner。

## 技术方案对比与取舍

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. expand 时枚举所有可能的 rollout 时间戳 | 无法预知 timestamp | 拒绝 |
| B. 把 `session_id_aliases` 打进 Shared list / ThreadSummary | 跨 IPC + catalog 面大 | 拒绝（本轮） |
| **C. 两边抽 canonical uuid 再比（采用）** | 不发明 alias；Win 盘符单独识别 | **采用** |

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `subagent-session-tree-navigation`：Shared hide / pup 判定 MUST 把 Codex rollout filename alias 与 canonical uuid 视为同一 identity；MUST 按平台区分路径形 id，禁止把 Windows 盘符或 POSIX 绝对路径当成 `engine:` 前缀。

## Impact

| 层 | 触点 |
|----|------|
| Frontend | `sharedSessionSummaries.ts`、新 `sharedHideIdentity.ts`、`useThreadActions.helpers.ts`（`threadIdInHiddenSharedBindingSet`）、Vitest |
| Specs | `subagent-session-tree-navigation` delta |
| 无 | IPC / Rust catalog / Session Index schema |

## 验收标准

1. Shared × Codex：parent 或 live id 为 `rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`，binding 为 `codex:{uuid}` → 侧栏不展示该崽；owner stem 行被 strip。
2. Windows：`S:\AIWorker\…`、`S:/…`、`\\?\C:\…`、UNC MUST NOT 被剥成 engine raw。
3. macOS / Linux：`/Users/…`、`/home/…` MUST NOT 被补成 `codex:/Users/…` 之类 hide 键，也不得误当 uuid。
4. Native 无 Shared owner：父子树不因本变更改变。
5. 无 parent → 仍不按标题隐藏。
6. focused Vitest + `openspec validate fix-shared-codex-sidebar-hide-alias --strict` 通过。
7. **不自动 commit**。
