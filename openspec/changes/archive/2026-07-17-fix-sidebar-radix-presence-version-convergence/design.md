## Context

The archived ScrollArea hotfix moved the `radix-ui` aggregate package from `@radix-ui/react-scroll-area@1.2.10` to `1.2.14` to obtain stable composed refs. That patch kept the pre-existing scoped `@radix-ui/react-presence@1.1.6` override, but ScrollArea `1.2.14` declares an exact `Presence@1.1.7` dependency. npm therefore installs two Presence copies beneath the same aggregate tree and reports the nested copy as invalid relative to the override.

The latest production diagnostic occurs during cold-start Sidebar hydration and attributes repeated commits to workspace rows, tooltip buttons, `Presence`, and `Primitive.div`. This is consistent with the invalid primitive graph, while existing AppShell composer and isolated Tooltip/ScrollArea tests remain green.

## Goals / Non-Goals

**Goals:**

- Make the `radix-ui` scoped ScrollArea/Presence dependency graph valid and deterministic.
- Preserve the React 19 fixes already obtained in Presence `1.1.6` and ScrollArea `1.2.14`.
- Add a contract that fails if a future exact transitive dependency conflicts with the scoped override.
- Cover multi-row Sidebar-shaped startup rerenders, not only one isolated ScrollArea.

**Non-Goals:**

- Upgrade the aggregate `radix-ui` package or every Radix primitive.
- Change Sidebar scroll behavior, workspace projection, or AppShell state ownership.
- Rewrite third-party dependency trees such as Excalidraw.

## Decisions

### Decision 1: Align the existing scoped Presence override to `1.1.7`

Presence `1.1.7` is a forward patch over `1.1.6` and remains within the exact dependency surface expected by ScrollArea `1.2.14`. Keeping the override under `overrides.radix-ui` limits the change to the aggregate package.

Alternative: delete the Presence override. Rejected because the aggregate package currently resolves older Presence versions for other primitives; removing the known React 19 fix would reintroduce nondeterminism.

Alternative: globally override Presence. Rejected because it would rewrite Excalidraw and other independent trees.

### Decision 2: Validate dependency compatibility from package manifests

The regression reads `package.json` and `package-lock.json`, asserting the scoped versions and absence of a nested conflicting Presence resolution. Verification also runs `npm ls`, because manifest assertions alone previously passed while npm still classified the installed graph as invalid.

Alternative: only assert fixed version constants. Rejected because it cannot detect exact transitive-version drift.

### Decision 3: Reuse the real ScrollArea and production row primitives in the focused regression

The test mounts multiple Sidebar-shaped workspace rows inside the real ScrollArea under `StrictMode`, repeats parent rerenders, and asserts DOM/ref continuity plus absence of maximum-update-depth errors. It remains a focused unit integration test rather than booting Tauri.

Alternative: rely only on repeated cold-start manual testing. Rejected because the failure is intermittent and would leave no executable contract.

## Risks / Trade-offs

- [Risk] jsdom cannot reproduce every WebKit commit timing → keep production diagnostics and require dependency-tree validity in addition to the render regression.
- [Risk] Presence `1.1.7` changes animation bookkeeping → run Tooltip, Popover-adjacent Sidebar, AppShell startup, lint, typecheck and production build gates.
- [Risk] a future aggregate upgrade makes overrides obsolete → the contract test should be updated together with the aggregate package and the scoped overrides removed only when upstream versions converge.

## Migration Plan

1. Update the scoped Presence override and regenerate `package-lock.json`.
2. Add dependency compatibility and multi-row StrictMode regressions.
3. Run focused and project quality gates.
4. Rollback by reverting manifest, lockfile and regression changes; no user-data migration is involved.

## Open Questions

- 无。若 valid dependency graph 的 rebuilt production package仍复现同一 stack，应新增 updater attribution evidence，而不是继续扩大本 change。
