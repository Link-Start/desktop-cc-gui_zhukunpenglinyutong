## Context

hide-alias 已把判定核（`collectSharedHideIdentityKeys` / `sharedHideIdentityIntersects` / `threadIdInHiddenSharedBindingSet`）接到 expand、pup、final strip。list orchestrator 的 **ingest 预过滤** 仍是另一套规则：

| 位点 | 现规则 | 缺什么 |
|---|---|---|
| live Codex `listThreads` ~1074 | `hideSet.has(entry.id)` | stem ≠ uuid |
| Claude / OpenCode live | `hideSet.has('engine:'+id)` | 前缀稳定时够用；合同不一致 |
| catalog ~1510 | exact + first-colon | stem 无冒号漏；盘符土地雷 |
| OpenCode / DSH continuity | `hideSet.has(thread.id)` | 合同不一致 |
| Gemini/Kimi/Grok/Pi/DSH cache 与异步 refresh | `hideSet.has('engine:'+id)` | 合同不一致 |

first-paint 跳过 catalog，live Codex 是唯一能把 stem 插进 merge map 的入口。final strip 能清 owner，但预过滤合同必须重写，不能靠下游补救冒充闭合。

约束：不合并 hide-alias change；不改 hide-unreadiness；不改 Rust `push_id`；不发明 rollout 时间戳。

## Goals / Non-Goals

**Goals:**

- 所有 Shared hide ingest 预过滤重写为 `threadIdInHiddenSharedBindingSet(candidate, hideSet)`。
- candidate = 该行进入侧栏后的 id（Codex 用 live/catalog 字面 id；其它引擎用 `engine:sessionId`）。
- 删除 catalog first-colon IIFE。
- 单测锁住「uuid-only hide set 丢掉 stem」与「路径 id 不误伤」。

**Non-Goals:**

- 不新写 matcher，不把 colon-split 与 identity 混用。
- 不回退 fail-closed，不改 last-good / full-show。
- 不改 Rust visibility writer。
- 不把 `gemini` / `dsh` 塞进 `SHARED_HIDE_ENGINE_PREFIXES`。
- 不按标题藏行。

## Decisions

### D1. 预过滤只复用判定核，不抽第二套函数

**选定**：各位点直接调用已导出的 `threadIdInHiddenSharedBindingSet`。

**否决**：再包一层 `shouldExcludeBySharedHideIdentity`——纯别名，增加漂移面。

### D2. candidate 用最终行 id，不用「剥完再比」

**选定**：

- Codex live：`entry.id`（可能是 stem / uuid / `codex:…`）
- catalog：`entry.sessionId`（与 `mergeCodexCatalogSessionSummaries` 同一 candidate）
- Claude / OpenCode live：已拼好的 `claude:` / `opencode:` id
- continuity：`thread.id`
- Gemini/Kimi/Grok/Pi/DSH：`` `${engine}:${session.sessionId}` ``

Gemini / DSH 不在 hide prefix 表里。若只传 bare，expand 后的 hide set 只有 `gemini:xxx`，bare 撞不上。必须传带前缀的行 id。

**否决**：catalog 继续 first-colon 当「兼容层」——正是要删的规则。

### D3. 协作标题闸仍留在 catalog 预过滤

catalog 在 hide 之后还有 `isSharedCollabWorkerSpawnTitle`。本轮只重写 hide 半段，标题闸不动。

### D4. 不改 hide-unreadiness 与 early-paint 投影

early-paint / Index projection 已走 `shouldExcludeOrdinaryNativeRow` → identity。本轮不碰 `shouldRememberHideUnreadiness`。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 漏改一处 `.has` 仍按旧规则 | 任务清单按位点勾选；改完 `rg 'hiddenSharedBindingIds\\.has'` 必须为零（本文件 Shared hide 用途） |
| `freshHiddenSharedBindingIds.has` 异步路径漏网 | 与同步 cache 预过滤同一改法 |
| 把 last-good 的 `id.indexOf(":")` 当成 hide 一起改 | 那是 engine 推断，不是 hide；禁止动 `useThreadActions.lastGoodSnapshots.ts` |
| 回归：可见 native 被误藏 | 路径 id + 无 hide 命中的 uuid 单测；native 父子树不在本轮改 parent |

## Migration Plan

纯 Frontend 热路径。无 schema / IPC 迁移。回滚：还原 `useThreadActions.ts` 预过滤即可；判定核 hide-alias 可独立保留。

## Open Questions

无。候选 id 形态与「不搬 0.8.9」已在 review 钉死。
