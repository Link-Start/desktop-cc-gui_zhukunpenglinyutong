# Design: fix-runtime-workspace-switch-main-thread-stall

## Problem model（2026-08-08 复测后校准）

```text
User: Project1 shared → Project2 shared
  activeWorkspaceId changes
  useAppShellSearchRadarSection requests projection summary immediately
    get_workspace_session_projection_summary(limit=9999)
      Codex → Claude source facts/cache rebuild → Gemini → Kimi → Grok
      → OpenCode external CLI → Shared
  // independent from list generation; cancelWorkspaceTasks cannot stop it

  selectWorkspace(B) + setActiveThreadId(shared:…)
  cancelWorkspaceTasks(A)  // soft-ignore: free slot, abort signal, mark generation stale
  ensure list(B) starts immediately
  orphan list(A) body STILL runs:
    titles → shared → codex pages → start multi-engine promises → merge → maybe setThreads skip
    + fire-and-forget gemini/kimi/grok that only checked requestSeq (not isStale)
  + shared history hydrate on B
  → CPU + main thread stack → 5–10s freeze
```

Cold-start gate does **not** cover this path (gate already ready)。首轮 early-stale 修复只处理下半段 orphan list；用户复测未改善，说明上半段 independent exhaustive projection 才是主链路。

## Approach

### D1 — Cooperative early exit in `listThreadsForWorkspace`（已完成，次要止损）

Introduce a local helper used at stage boundaries:

```ts
const abandonIfStale = (): { applied: false; stale: true } | null =>
  isLatestThreadListRequest() ? null : { applied: false, stale: true };
```

`isLatestThreadListRequest` already means:

```ts
threadListRequestSeqRef[workspace.id] === requestSeq && !(options?.isStale?.() ?? false)
```

**Checkpoints (must):**

| Stage | When |
|-------|------|
| Before titles IPC | entry of try (after setup) |
| After titles | before shared sessions |
| After shared sessions | before codex paging |
| Each codex page | after await, before next page / more work |
| Before multi-engine promise construction | must not *start* catalog/claude/opencode if stale |
| After Promise.allSettled | keep existing |
| Before yield + setThreads | keep existing |
| gemini/kimi/grok background | use `isLatestThreadListRequest()` not bare seq |

### What we accept

- One already-in-flight invoke may finish after cancel (no hard IPC abort).
- After that settle, body returns and starts **no further** stages.

### What we do not do in MVP

- Hard-abort native list commands.
- History hydrate chunking for Shared.
- AppShell structural split.

### D2 — AppShell owner topology MUST be local derived data（主修复）

AppShell 只消费 `summary.ownerWorkspaceIds`，不消费 active/archive/folder counts。owner scope 已完整存在于 `workspaces`：

```text
active id absent            => []
active id registry pending  => [active id]
active workspace=worktree   => [active id]
active workspace=main       => [active id, ...direct parentId children sorted by path/name/id]
```

新增 pure resolver 并在 render 内 `useMemo` 推导；删除 AppShell 对 `useWorkspaceSessionProjectionSummary` 的依赖。该算法镜像 Rust `catalog_workspace_scope`，以 `parentId` 兼容 legacy missing-kind child，只决定哪些 owner list 参与 Sidebar/Recent/Radar 聚合，不重新实现 session membership。

Settings/Session Management 仍调用 projection summary，因为该 surface 确实消费 totals、folder counts 与 source statuses。API 和 backend exhaustive semantics 本轮不改。

### D3 — 为什么不回退 Claude scanner v5

v5 修复 CJK path bucket collision 与 transcript cwd 越界归属，是 correctness 修复。回退会重新泄漏 foreign sessions。正确做法是让 navigation 不触发 exhaustive scan，使 cache rebuild 只发生在显式管理/有界 catalog 路径，而不是恢复错误 cache。

### D4 — 为什么不撤销 hydration race 修复

`9e3c1bdd8` 保证 `workspacesById` 到达后 first-paint 一定执行，修复真实的 Sidebar 永久“加载中…”问题。不能用恢复竞态跳过工作来换取表面性能；应让被稳定执行的路径本身有界。

### D5 — Sidebar click 不得擦 last thread，也不得在点击帧 hydrate

S0–S5 修的是 list stale 与 projection IPC。复测后真正还在炸的路径是侧栏 `handleSelectWorkspace`：

```text
click workspace B
  setActiveWorkspaceId(B)
  ensureWorkspaceThreadListLoaded(B)  // already-hydrated => kind=full-catalog, click frame
  setActiveThreadId(null, B)          // wipes last thread; canvas empty until user re-clicks
```

`activeThreadId` 由 `activeThreadIdByWorkspace[activeWorkspaceId]` 派生。只要点击不写 `null`，A→B→A 会自动回到上次会话；若 item cache 被 LRU 挤掉，需要再 `setActiveThreadId(last)` 才能走既有 resume / curtain。

点击帧的 `ensureWorkspaceThreadListLoaded` 对已 hydrate workspace 会走 full-catalog，绕过 hydration hook 的 100ms/300ms quiet gate，这才是「点项目卡 5–10s」的残留主因。列表仍由 `activeWorkspaceId` 变化后的 quiet-gated first-paint 负责。

Cycle 是兄弟路径：旧实现用第一行或 `null` 覆盖 last thread。新策略 last > first-listed > keep-map，永不写 `null`。

Last-thread peek 走 `useThreads` 发布的模块快照，不往 `sessionIdentityContext` 加 bag key（hard freeze 14）。快照 MUST 在 committed `useEffect` 里发布并浅拷贝；禁止在 render 期写入，避免 discarded concurrent render 污染 peek。

S6 只改了 `handleSelectWorkspace`。复盘后发现侧栏项目行并不走它：`WorkspaceCard` 只要拿到 `onOpenWorkspaceHome` 就进 `handleOpenWorkspaceHome`，后者 `setActiveThreadId(null)`。所以 A→B→A 的真实热路径仍在擦 last thread。S7 把非 active 行改回 `onSelectWorkspace`；只有已经 active 的行才保留显式 home。

## Test plan

1. **Unit**: mid-flight `isStale` flips true after titles → `listThreads` / `listWorkspaceSessions` / gemini not called (or not beyond injection point); no `setThreads`.
2. **Unit**: local topology covers main + direct worktrees、worktree isolation、registry pending fallback。
3. **Hook regression**: render/switch AppShell search-radar section does not call projection summary and passes local owner ids into hydration.
4. **Regression**: existing timeout-fallback / hydration cancel tests stay green.
5. **Manual**: cross-project shared switch (user).
6. **Unit**: sidebar click / cycle restore last thread and never write `null`; click handler source has no `ensureWorkspaceThreadListLoaded`.

## Relation to cold-start change

| Concern | cold-start change | this change |
|---------|-------------------|-------------|
| first-paint vs full-catalog | ✅ | reuse modes |
| gate-ready stamp | ✅ | untouched |
| soft-ignore slot free | ✅ | keep |
| orphan body early exit | partial (late checks) | **fix** |
| navigation exhaustive projection | 未覆盖 | **移出热路径** |
| runtime switch pressure | gap #2 | **两层闭环** |
