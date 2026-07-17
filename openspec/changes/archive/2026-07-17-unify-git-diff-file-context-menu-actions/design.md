## Context

`DiffFileRow` and `DiffSection` are already the shared changed-file renderer for single-repository and multi-repository Diff surfaces. The row forwards `contextmenu` through `onShowFileMenu(event, path, section)`.

Single-repository mode connects that callback to `GitDiffPanel.showFileMenu`, while `GitMultiRepositoryChanges` currently supplies no-op callbacks for staged and unstaged sections. Because the no-op does not call `preventDefault()`, the WebView native menu appears. The existing single-repository menu also derives actions by path across both sections and hardcodes English labels, so it does not provide a stable section-aware contract.

Relevant constraints:

- `GitDiffPanel` already owns the shared `RendererContextMenu` portal/state and destructive discard dialog.
- Multi-repository mutations require explicit `repositoryRoot`; empty string is a valid workspace-root identity.
- `DiffFileRow` is also reused by Git History surfaces and must remain presentation-only.
- `GitDiffPanel.tsx` is already a large orchestration file, so reusable item construction should not grow inline.
- Existing i18n keys cover the menu title and all Stage / Unstage / Discard labels.

## Goals / Non-Goals

**Goals:**

- 让 single-repository flat/tree 与 multi-repository grouped Diff rows 使用同一 Git submenu presentation 和 action matrix。
- 让 mutation target 由 clicked section 与 explicit repository scope 决定。
- 保留 single-repository same-section multi-selection。
- 复用现有 Stage / Unstage callbacks、multi status refresh 与 discard confirmation。
- 用 focused tests 锁定 same-path、empty root、disabled mutation 与 event isolation。

**Non-Goals:**

- 不增加 File History、Blame、Open file 或 repository-level commands。
- 不把 menu logic/service calls 下沉到 `DiffFileRow`。
- 不修改 backend command、Tauri payload、polling 或 commit-selection model。
- 不引入跨 repository 或跨 section bulk mutation。

## Decisions

### 1. Focused pure builder generates one `Git` submenu

新增 `GitDiffPanelFileContextMenu.ts`，接收 translated `TFunction`、action count 与 already-scoped callbacks，返回 `RendererContextMenuItem[]`。Builder 只负责：

- stable item IDs；
- singular/plural label selection；
- `Git` submenu grouping；
- destructive separator 与 danger tone；
- empty action set 时返回空数组。

它不读取 React state、不解析 repository identity、也不调用 Tauri service。

**Alternative considered:** 在 single/multi handler 中分别拼 items。代码更短，但 i18n、action order 与 danger treatment 会继续漂移，因此不采用。

### 2. `GitDiffPanel` remains the only menu/dialog host

Data flow:

```text
DiffFileRow
  -> DiffSection.onShowFileMenu(event, path, section)
    -> single: GitDiffPanel.showFileMenu
    -> multi: GitMultiRepositoryChanges adds repositoryRoot
       -> GitDiffPanel.showRepositoryFileMenu
          -> shared builder
             -> existing RendererContextMenu
```

`GitMultiRepositoryChanges` 增加 optional repository-aware callback：

```ts
onShowFileMenu?(
  event,
  repositoryRoot,
  path,
  section,
): void
```

两处 `DiffSection` callback 都必须转发 row owner 的 `repositoryRoot`。`GitDiffPanel` 根据 `repositoryStatuses` 与 clicked section 核对该 file 是否 status-backed 且 mutation-enabled。

**Alternative considered:** `GitMultiRepositoryChanges` 自己持有 menu state。它会复制 portal、dismiss、viewport clamp 与 dialog policy，因此不采用。

### 3. Action matrix is section-aware

| Clicked section | Actions |
|---|---|
| staged | Unstage |
| unstaged | Stage, separator, Discard |

Single-repository target selection 只保留 clicked section 内、mutation-enabled 的 selected paths。即使同一路径同时存在 staged/unstaged evidence，menu 也只生成 clicked row section 对应的 operation。

Multi-repository mode 当前没有 row multi-selection；每个 menu action 只作用于 clicked `repositoryRoot + path`。

### 4. Mutation callbacks preserve existing refresh/confirmation policy

- single Stage / Unstage 继续调用既有 callbacks；本 change 不新增独立 mutation error UI。
- multi Stage / Unstage 成功后调用一次 aggregate `onRefreshRepositoryStatuses`。
- mutation rejection 不得触发 success refresh 或 fallback 到其他 repository；保留既有 callback/runtime error semantics。
- single Discard 调用现有 current-repository dialog target。
- multi Discard 调用现有 explicit-repository dialog target；confirm 成功后由现有 flow refresh 一次。
- menu open、submenu open、dismiss 与 cancel 不执行 mutation 或 refresh。

### 5. Unsupported rows suppress mutation without falling back to native menu

所有 changed-file row 的 handler 先 `preventDefault()` / `stopPropagation()`。如果 target 是 diff-only fallback、`mutationDisabled`、stale/missing，或没有可用 callback，则不创建菜单。这样既不暴露错误 mutation，也不会重新泄漏 WebView native menu。

File context-menu state 带 feature-local source marker；workspace、Git root、repository/file topology、loading state 或 mutation callback identity 变化时，parent 只关闭该 file menu，避免打开瞬间的 callback closure 在 stale target 上继续执行，同时不干扰 log / pull-request 等其他 context menu。

## Risks / Trade-offs

- **[Risk] Single-repository historical cross-section bulk menu changes behavior** → 只保留同 section bulk target，并通过 staged/unstaged same-path tests 明确新契约；commit-selection state 本身不变。
- **[Risk] Multi Stage / Unstage double refresh** → context-menu path 直接调用 scoped callback 后只显式 refresh 一次；不复用 `DiffSection` inline wrapper。
- **[Risk] Empty `repositoryRoot` lost through falsy checks** → callback 和 dialog target 原样传递 string，并加入 `repositoryRoot === ""` test。
- **[Risk] Stale repository/file lookup creates wrong mutation** → handler 按 exact repository identity、section 与 normalized path 查找；missing target 直接 no-op。
- **[Risk] Menu open 后 topology 切换仍保留旧 callback** → file menu source marker + dependency invalidation effect 立即关闭 stale menu，并用 rerender regression test 锁定。
- **[Risk] Helper becomes a generic menu abstraction** → 保持 feature-local，只表达 Git Diff file mutation menu，不提升到 shared UI。

## Migration Plan

1. 新增 focused menu builder。
2. 将 single menu 改为 section-aware builder 调用。
3. 增加 multi repository-aware callback，替换 staged/unstaged no-op。
4. 补齐 component regression tests。
5. 更新 Trellis executable contract 与 OpenSpec main spec。
6. 运行 focused/full gates，verify 后 sync/archive。

Rollback 仅需回退 helper 与 callback wiring；没有 backend、schema、persistent data 或 migration 副作用。由于工作区含已确认的前序未提交变更，回滚必须使用 scoped patch，不得执行整文件 checkout/reset。

## Open Questions

无。用户已确认采用只包含 Stage / Unstage / Discard 的推荐范围 A。
