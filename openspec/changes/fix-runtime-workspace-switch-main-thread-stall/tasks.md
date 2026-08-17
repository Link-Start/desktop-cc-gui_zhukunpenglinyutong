# Tasks: fix-runtime-workspace-switch-main-thread-stall

## S0 — Spec & plan

- [x] proposal.md / design.md / tasks.md
- [x] specs/runtime-workspace-switch-hydration/spec.md

## S1 — listThreads early-stale

- [x] `useThreadActions.ts`: `abandonIfStale` + checkpoints before/after major IPC stages
- [x] Do not construct multi-engine fan-out promises when already stale
- [x] gemini / kimi / grok background refresh honor `isLatestThreadListRequest` (incl. isStale)

## S2 — Tests

- [x] Mid-flight isStale: no further list IPC + no setThreads (`useThreadActions.stale-list-abandon.test.tsx`)
- [x] Existing hydration cancel + orchestrator suites still pass

> Known unrelated test-harness issue: `useThreadActions.timeout-fallback` case 1 can hang 20s under fake-timer/rAF even without this change；它不属于本 change 的完成项。

## S3 — Verify (no commit)

- [x] focused vitest green (stale-abandon + hydration + orchestrator + shared-history)
- [x] leave working tree uncommitted for user hand test

## S4 — Root-cause correction after failed manual acceptance

- [x] Record that the 2026-08-08 early-stale build did not materially improve the original switch freeze
- [x] Trace independent AppShell `projection summary -> limit=9999 -> all-engine catalog` chain
- [x] Replace navigation projection IPC with local main/direct-worktree topology derivation
- [x] Preserve worktree isolation and workspace-registry-pending fallback
- [x] Add pure topology tests and AppShell no-projection regression
- [x] Remove unsafe `return` from hydration `finally` without changing idle full-catalog guards

## S5 — Closeout evidence (no commit)

- [x] Write version/author/root-cause performance analysis and link prior incident docs
- [x] Run focused Vitest, TypeScript, target lint, docs, runtime contract, large-file, doctor, and OpenSpec strict validation
- [ ] User manual test: repeatedly switch projects and open Shared/native sessions; confirm no 5–10s whole-window freeze

> Automated result：focused Vitest、target ESLint、typecheck、runtime contracts、large-file 与 OpenSpec strict 通过。Repository-wide `pnpm test`、`pnpm lint`、`check:docs`、`doctor:strict` 命中未改文件中的既有 baseline 问题；已在交付说明列出，不冒充本 change 回归。

## S6 — Sidebar / cycle must restore last thread (re-analysis)

S0–S5 没有覆盖「侧栏点项目」这条真实热路径：`handleSelectWorkspace` 在点击帧 `setActiveThreadId(null)` + `ensureWorkspaceThreadListLoaded`。A→B→A 会丢掉 last thread，已 hydrate workspace 还会在点击帧走 full-catalog，表现为切回去画布空、整窗卡 5–10s。

- [x] Extract `planWorkspaceNavigationThread` and keep last-thread peek off the AppShell bag
- [x] Sidebar click: `selectWorkspace` + restore last thread; MUST NOT null the map; MUST NOT `ensureWorkspaceThreadListLoaded` on the click frame
- [x] Workspace cycle: restore last thread, else first-listed fallback; MUST NOT `setActiveThreadId(null)`
- [x] Publish `activeThreadIdByWorkspace` snapshot from `useThreads` after commit (not render phase)
- [x] Focused tests: planner, last-thread map, cycle restore, sidebar click source policy

## S7 — 真正的侧栏点击热路径（re-analysis）

S6 改了 `handleSelectWorkspace`，但侧栏项目行走的是 `WorkspaceCard` → `onOpenWorkspaceHome` → `handleOpenWorkspaceHome` → `setActiveThreadId(null)`。A→B→A 仍然丢掉 last thread。

- [x] Inactive workspace row calls `onSelectWorkspace`; only the already-active row may open workspace home
- [x] Update WorkspaceCard / Sidebar tests so inactive click no longer expects home
- [x] Spec: 非 active 行 MUST restore last thread；active 行 MAY 走显式 home
- [x] Review lock: last-thread map snapshots committed state; WorkspaceCard source gates home behind `isActive`
