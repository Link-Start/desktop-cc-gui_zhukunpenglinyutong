## 架构决策

### 核心问题：两套事实源并轨

变更前，会话管理中心与侧栏 threads 走两套完全独立的 lifecycle：

```text
┌─ 会话管理中心 ─────────────┐    ┌─ 侧栏 Threads ────────────┐
│ build_*_catalog_data()     │    │ useThreadActions           │
│  ├ codex/claude/gemini/... │    │  ├ listSharedSessions      │
│  └ ❌ 不扫 shared          │    │  ├ deleteSharedSession     │
│                            │    │  └ resumeThread            │
│ delete/archive 对 shared   │    │                            │
│ 硬拒绝 (phase-one)          │    │                            │
└────────────────────────────┘    └────────────────────────────┘
```

变更后，Catalog 把 shared 当一等源接入，Lifecycle router 按 `engine` 字段分发：

```text
┌─ Unified Catalog ──────────────────────────────────────────┐
│ build_*_catalog_data()                                     │
│  ├ codex / claude / gemini / kimi / grok / opencode         │
│  └ ✅ shared ← list_workspace_shared_sessions              │
│                                                            │
│ Lifecycle Router (by entry.engine)                         │
│  ├ "codex" → physical delete + metadata cleanup            │
│  ├ "claude" / "gemini" / ... → native engine delete        │
│  └ "shared" → delete_shared_session_files + metadata       │
└────────────────────────────────────────────────────────────┘
```

### Shared Catalog Entry 设计

`build_shared_catalog_entry` 从 `SharedSessionSummary` 构造
`WorkspaceSessionCatalogEntry`：

| 字段 | 值 | 理由 |
|---|---|---|
| `session_id` | `summary.thread_id` (`shared:{uuid}`) | 匹配 `parse_catalog_identity` → `Shared` |
| `canonical_session_id` | `summary.id` (raw UUID) | mutation 时用于构造 `thread_id` |
| `engine` | `"shared"` | delete router 的 match key |
| `thread_kind` | `"shared"` | 前端 `isSharedCatalogEntry` 判断依据 |
| `source` | `selected_engine.icon()` | 幕布图标反推 selected engine |
| `exists_on_disk` | `false` | shared 目录≠engine history dir，暂不检测 |

### Delete 路由

```text
resolve_session_mutation_target(entries, session_id)
  → target.engine = "shared"
  → delete_workspace_sessions_core match "shared"
    → thread_id = target.requested_session_id (已有 shared: 前缀)
      或 format!("shared:{}", target.native_session_id)
    → delete_shared_session_files(workspace_id, thread_id)
      → parse_shared_session_id → shared_session_dir → remove_dir_all
    → metadata cleanup (清 catalog metadata 中的对应条目)
```

### 幕布加载

```text
loadSessionCurtainItems(entry)
  → engineRaw === "shared" || threadKind === "shared"
  → createSharedHistoryLoader({ workspaceId, loadSharedSession, loadSharedProjection })
  → loader.load(threadId)
  → snapshot.items
```

关键 guard：在所有 `normalizeEngineType(entry.engine) === "codex"` 的分支前，
先检查 `isSharedCatalogEntry(entry)`，防止 shared 误入 Codex 双源加载路径。

### 前端 Utils 设计

```typescript
// 三个独立判断维度，任一命中即为 shared
isSharedCatalogEntry(entry):
  entry.threadKind === "shared"
  || entry.engine.trim().toLowerCase() === "shared"
  || entry.sessionId.startsWith("shared:")

// 图标解析优先用 source 字段（selected engine icon）
resolveCatalogEntryEngineIcon(entry):
  if shared → entry.source (claude/codex/gemini/...)
  else → normalizeEngineType(entry.engine)
```

## 风险

1. **Shared 删除仅删目录**：与 `delete_shared_session` 行为一致，
   如果 shared session 有关联 native binding 会话，native 侧不会被级联删除。
   这是产品决策，需在 UI 或文档中说明。
2. **`exists_on_disk` 恒 false**：inconsistency detection 不会标记
   已删除的 shared 目录。后续可加 `shared_session_dir` 存在性检查。
3. **`source_completeness` 不够精确**：当前恒报 `AuthoritativeEmpty`，
   不影响功能但影响 source status 展示。
