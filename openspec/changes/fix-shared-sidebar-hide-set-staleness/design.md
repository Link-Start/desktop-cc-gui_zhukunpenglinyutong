## Context

Shared Hidden Native Binding 契约：

```text
list_shared_sessions.nativeThreadIds
  → expandHiddenSharedBindingIds (raw / engine:raw / pending)
  → hiddenSharedBindingIds
  → native list merge 跳过 / strip
```

上游 `fix-shared-hidden-binding-visibility` 解决了 **identity 对齐**（Grok `-s` 预分配、
Kimi/OpenCode rebind）。本次解决 **FE list 时序**：hide set 在 `listThreadsForWorkspace`
开头构建后被异步闭包长期持有，create Shared 时 binding 为空 → 空 hide set 在 binding
materialize 后仍用于 merge。

## Goals / Non-Goals

**Goals**

1. 异步 native refresh 使用新鲜 hide set（并 ∪ outer）。
2. merge 可 purge baseline 泄漏。
3. 主路径 final gate 防 continuity / last-good 漏网。
4. 跨引擎审计结论落入 design，避免「只修 Grok」。

**Non-Goals**

- 不改 Rust materialize / send pipeline。
- 不自动 purge 历史 orphan 磁盘 session。

## Decisions

### D1 — 异步路径重建 hide set（fresh ∪ outer）

对 Grok / Kimi / Gemini 异步分支：

1. `listGrokSessions`（或 Kimi/Gemini）完成后，再 `listSharedSessions`。
2. `requestSeq` 再校验（防 listShared 等待期间被更新请求取代）。
3. `freshHide = expand(nativeThreadIds ∪ outerHideIds)`。
4. merge 使用 `freshHide`；dispatch 前再 `stripHiddenSharedBindingSummaries`。

**为何 ∪ outer**：`listSharedSessions` 失败 `catch → []` 时，纯 fresh 会变成空集并
**放宽**可见性；并集保证「最多更严、绝不更松」。

### D2 — merge 双向 strip，禁止 empty-sessions early-return 原 base

`mergeNativeCliSessionSummaries`：

- 先 strip baseline by hide set。
- sessions 为空时 return **stripped** base，不是原 base。
- session 循环内再 guard `hidden.has(id)`。

### D3 — 主路径 final hide 闸门

在 `setThreads` 前对 `visibleSummaries` 执行 strip，兜底 cache merge / continuity /
degraded fallback 任一路经带入的 hidden id。

### D4 — 跨引擎路径矩阵（审查结论）

| Engine | 侧栏 native 来源 | hide 应用时机 | 同类 stale 闭包洞？ | 说明 |
|--------|------------------|---------------|---------------------|------|
| **Claude** | 主路径同步 `listClaudeSessions` / catalog | 写入 `mergedById` 前 `hidden.has(id)`；last-good seed 传 hide | **否** | 与 `hiddenSharedBindingIds` 同源同帧；无 post-list 异步 re-merge |
| **Codex** | 主路径同步 project catalog | `projectCatalogSessions.filter(!hidden.has(sessionId))` | **否** | 同步；catalog `sessionId` 经 expand 覆盖 raw/`engine:` |
| **OpenCode** | 主路径同步 `getOpenCodeSessionList` | 写入前 `hidden.has(opencode:id)` | **否** | 同步；timeout 时 last-good seed 也带 hide |
| **Grok** | **异步** `listGrokSessions` fire-and-forget | 修复前用闭包 stale hide | **是** | create Shared(engine=grok) 触发 `hasGrokSignal` → 异步 refresh |
| **Kimi** | **异步** `listKimiSessions` | 同构 | **是** | 与 Grok 同代码模板 |
| **Gemini** | **异步** `listGeminiSessions` | 同构 | **理论是** | Shared Gemini 已退役；防御性同修，避免遗留 binding |

**Claude / Codex / OpenCode 残余风险（可接受）**

| 风险 | 等级 | 备注 |
|------|------|------|
| 主路径 list 中途 binding 才 materialize | 低 | 下一帧 list 或 final strip 收敛；无 fire-and-forget 二次 dispatch |
| catalog `sessionId` 格式与 hide 不一致 | 低 | 已有 `expandHiddenSharedBindingIds` |
| last-good 缓存含历史泄漏 | 低 | seed 时传 `excludedThreadIds=hide`；final strip 再兜底 |
| identity 仍分叉（CLI 无视预分配 id） | 中（产品层） | 属上游 identity change；本次不重开 |

**不在本次修的路径**

- `onThreadStarted` 在无 `sharedBridge` 时注入 native：Shared 发送路径应有 bridge；若
  漏 bridge 是另一类 event-routing 问题，非 hide set staleness。
- 历史 orphan：明确非目标。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 异步路径多一次 `listSharedSessions` | 正确性优先；与 remap 共用结果 |
| hide 并集过严误伤 | 仅 Shared-owned ids 进入 hide set |
| race 极短窗口闪 native | 可接受；下一 refresh 清除 |

## Migration

- 无 storage migration。
- 已泄漏侧栏行：下次 listThreads / 异步 refresh 后 strip。
- 磁盘 orphan：手动删除。

## Implementation map（已实现，待 commit）

| 文件 | 变更 |
|------|------|
| `useThreadActions.helpers.ts` | `stripHiddenSharedBindingSummaries`；merge 双向 strip |
| `useThreadActions.ts` | 异步 Grok/Kimi/Gemini fresh∪outer hide；final gate |
| `*.helpers.test.ts` / `*.shared-native-compat.test.tsx` | strip / race / purge |

## Open Questions

无。
