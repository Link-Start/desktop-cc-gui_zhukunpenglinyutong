## Why

Workspace sidebar loading currently combines active-workspace hydration, idle prewarm, multi-engine source recovery, last-good continuity, and catalog membership. The behavior exists across several contracts, but the missing change artifacts make ownership and acceptance ambiguous and invite root-render polling or blank-list regressions.

## 2026-07-18 代码校准

- **裁定：当前代码已实现，自动化闭环后建议归档**。原 `0/11` 是 artifacts 晚于代码创建造成的状态漂移。
- `useWorkspaceThreadListHydration.ts` 已实现 `active-workspace → idle-prewarm → on-demand`、active priority、in-flight/hydrated dedupe、idle scheduling 与 stale result 不落 hydrated state。
- thread actions 已实现 engine-scoped last-good continuity、partial/degraded source isolation 与 authoritative archive/delete removal。
- 2026-07-18 focused suite 4 files / 32 tests 通过；其中直接覆盖 active-first、no duplicate prewarm、stale retry、load older、degraded continuity 与 no resurrection。
- startup trace 中“无 root render storm”属于全局 render-perf 验收，不应重复阻塞 sidebar contract 归档；该风险由项目 Render Perf Baseline 与 large-history closure change 持续治理。

## What Changes

- Define a staged hydration model: active workspace first, related owner scopes next, inactive workspaces during idle time.
- Keep foreground thread switching responsive while background catalog hydration runs.
- Preserve engine-scoped last-good continuity under partial sources without widening authoritative membership.
- Add a dedicated `workspace-sidebar-session-loading` capability for orchestration and loading-state semantics.

## Capabilities

### New Capabilities

- `workspace-sidebar-session-loading`: staged hydration, deduplication, stale-result rejection, and foreground responsiveness.

### Modified Capabilities

- `workspace-session-catalog-projection`: catalog hydration remains non-blocking and scope-aware.
- `claude-session-sidebar-state-parity`: Claude continuity survives partial staged hydration.
- `codex-session-sidebar-state-parity`: Codex continuity survives partial staged hydration.
- `sidebar-list-timeout-fallback`: engine-specific snapshots remain isolated during staged hydration.

## Impact

- Documentation scope: sidebar hydration orchestration and its cross-capability contracts.
- Expected implementation surfaces when work resumes: `useWorkspaceThreadListHydration`, `useThreadActions`, catalog adapters, sidebar loading state, and focused tests.
- No production code is changed by this artifact restoration.
