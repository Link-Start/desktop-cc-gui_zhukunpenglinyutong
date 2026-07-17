# Project Context

- Type: OpenSpec Workspace
- Updated At: 2026-07-17T23:57:51+08:00
- Scope: governance snapshot for the current `mossx` repository workspace
- Product version fact: `ccgui@0.7.5` from `package.json` and `src-tauri/tauri.conf.json`

## Domain

OpenSpec workflow and governance for `mossx`, covering change lifecycle, main spec maintenance, validation, sync, and archive discipline.

The product in this repository is `ccgui`: a Tauri 2 desktop AI engineering workbench that integrates multiple coding engines, project intelligence, task execution, session activity, memory, terminal, Git, and governance surfaces.

## Architecture

- Product app: Tauri 2 + React 19 + TypeScript + Vite
- Frontend source: `src/**`
- Rust backend source: `src-tauri/src/**`
- Spec artifacts: `openspec/specs/*`
- Change workflow artifacts: `openspec/changes/<change-id>/{proposal,design,tasks,verification}.md`
- Archive: `openspec/changes/archive/*`
- Implementation rules: `.trellis/spec/**`
- Current workspace state: active changes = `11`, archive changes = `631`, main specs = `403`

## Entry Surfaces

- `AGENTS.md`
  - repository entry, rule priority, PlanFirst gate, OpenSpec/Trellis boundary, merge guardrails
- `README.md` / `README.zh-CN.md`
  - product overview, development commands, documentation map
- `docs/README.md`
  - repository documentation hub and current-truth / dated-snapshot boundary
- `openspec/README.md`
  - concise OpenSpec navigation and common commands
- `openspec/project.md`
  - detailed governance overview and current workspace snapshot
- `openspec/changes/README.md`
  - active proposal index, progress, current closure gates, and links to change-local artifacts
- `openspec/changes/archive/README.md`
  - complete proposal index for all archived changes, grouped by month and archive date
- `openspec/specs/README.md`
  - complete index for synced mainline capability specs
- `openspec/docs/README.md`
  - durable OpenSpec references and dated audit/evidence snapshots
- `openspec/changes/<change-id>/*`
  - change-local truth for proposal, design, tasks, and verification
- `openspec/specs/*`
  - mainline capability truth after sync/archive
- `.trellis/spec/**`
  - code-level implementation contracts and development rules

## Governance Model

- `AGENTS.md`
  - repo entry, global gates, minimal reading path, session record invariant, merge guardrails
- `.trellis/spec/**`
  - frontend/backend/guides implementation rules and executable contracts
- `openspec/**`
  - behavior specs, change workflow, archive, and workspace governance
- `.claude/**` / `.codex/**`
  - host hooks, commands, skills, and adapter glue
- `.omx/**` and local state files
  - runtime artifacts, not repository truth

## Current Inventory

- Active changes: `4`
- Archive changes: `638`
- Main specs: `406`
- Completed task sets still active: `0`
- Ready-for-implementation task sets: `0`
- Demand-pool proposal directories without `proposal.md` / `tasks.md`: `0`

## Active Changes

Active OpenSpec changes in the current working tree:

- [`add-linux-native-menu-localization`](changes/add-linux-native-menu-localization/proposal.md) — 4/5; Rust gate passed, only Linux non-default-language startup smoke remains.
- [`harden-conversation-rendering-for-large-history`](changes/harden-conversation-rendering-for-large-history/proposal.md) — 35/38; blocked on heavy-history manual evidence, performance budget finalization, and human acceptance.
- [`enable-claude-lightweight-streaming-and-frame-attribution`](changes/enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) — 15/18; implementation complete, blocked only on the shared heavy-history/Claude-stream trace and archive.
- [`2026-06-22-release-pipeline-cache-sccache`](changes/2026-06-22-release-pipeline-cache-sccache/proposal.md) — 11/13; live artifact contract passed but timing SLO failed; requires residual-risk follow-up, not more cache layering.

Calibration rule: `openspec validate --strict` proves artifact structure only. Implementation verification uses code/test/live-run evidence in each `verification.md`; manual gates may be waived only when deterministic coverage or a newer owner makes the old gate non-discriminating.

Complete active artifact links are maintained in the [`OpenSpec Change Index`](changes/README.md).

## P1 Performance Execution Order

The previous v0.5.11 performance and recovery follow-up chain has been archived. Future performance work should open a new chain instead of reusing the archived change directories.

## Recent Archive / Sync Snapshot

### 2026-07-18 Code-Calibrated Closure Batch

Archived six stale active changes after calibrating them against current code:

- Synced implemented delta specs and archived:
  - [`add-askuserquestion-default-mode-mcp-bridge`](changes/archive/2026-07-18-add-askuserquestion-default-mode-mcp-bridge/proposal.md)
  - [`optimize-conversation-streaming-render-perf`](changes/archive/2026-07-18-optimize-conversation-streaming-render-perf/proposal.md)
  - [`fix-sidebar-session-catalog-progressive-loading`](changes/archive/2026-07-18-fix-sidebar-session-catalog-progressive-loading/proposal.md)
  - [`redesign-workspace-sidebar-session-loading`](changes/archive/2026-07-18-redesign-workspace-sidebar-session-loading/proposal.md)
- Force-archived without spec sync because the delta was not implemented:
  - [`2026-06-24-retire-opencode-and-gemini-cli`](changes/archive/2026-07-18-2026-06-24-retire-opencode-and-gemini-cli/proposal.md)
  - [`2026-06-24-infer-thread-rename-from-claude-codex-jsonl`](changes/archive/2026-07-18-2026-06-24-infer-thread-rename-from-claude-codex-jsonl/proposal.md)

### 2026-07-17 Near-Complete Closure Batch With Manual QA Waivers

Archived five near-complete changes after rechecking implementation evidence and strict validation:

- Fully closed by existing or newly rerun evidence:
  - [`fix-codex-thread-start-continuity-and-recovery`](changes/archive/2026-07-17-fix-codex-thread-start-continuity-and-recovery/proposal.md)
  - [`fix-codex-pending-draft-history-loading`](changes/archive/2026-07-17-fix-codex-pending-draft-history-loading/proposal.md)
- Archived with explicit user-authorized manual QA waivers while leaving the manual tasks unchecked:
  - [`fix-workspace-drop-overlay-leave-settlement`](changes/archive/2026-07-17-fix-workspace-drop-overlay-leave-settlement/proposal.md)
  - [`fix-sidebar-radix-presence-version-convergence`](changes/archive/2026-07-17-fix-sidebar-radix-presence-version-convergence/proposal.md)
  - [`add-claude-runtime-mcp-servers-panel`](changes/archive/2026-07-17-add-claude-runtime-mcp-servers-panel/proposal.md)

The batch created `claude-runtime-mcp-servers-panel` and updated six existing main capabilities. The Codex continuity delta required semantic calibration: the runtime-shutdown scenarios were merged into the current `Internal Codex Runtime Shutdown MUST NOT Masquerade As Foreground Turn Loss` requirement, while create-session retry/readiness scenarios were applied to their canonical `codex-stale-thread-binding-recovery` capability. Core performance-trace, performance-budget, Rust-validation, and implementation backlogs remain active. Final counts are active=10, archive=631, specs=403.

### 2026-07-17 Verified Git And Surface Closure Batch

Archived 22 active changes whose artifacts were complete, task sets were 100% complete, and individual strict OpenSpec validation passed:

- [`fix-codex-subagent-sidebar-projection`](changes/archive/2026-07-17-fix-codex-subagent-sidebar-projection/proposal.md)
- [`fallback-untracked-added-file-empty-inline-diff`](changes/archive/2026-07-17-fallback-untracked-added-file-empty-inline-diff/proposal.md)
- [`add-turn-file-summary-modal-diff-preview`](changes/archive/2026-07-17-add-turn-file-summary-modal-diff-preview/proposal.md)
- [`fix-large-file-editable-diff-alignment`](changes/archive/2026-07-17-fix-large-file-editable-diff-alignment/proposal.md)
- [`unify-git-file-list-and-preview-modal`](changes/archive/2026-07-17-unify-git-file-list-and-preview-modal/proposal.md)
- [`align-codex-model-reasoning-capabilities`](changes/archive/2026-07-17-align-codex-model-reasoning-capabilities/proposal.md)
- [`add-multi-repository-git-command-center`](changes/archive/2026-07-17-add-multi-repository-git-command-center/proposal.md)
- [`stabilize-git-command-center-branch-menu`](changes/archive/2026-07-17-stabilize-git-command-center-branch-menu/proposal.md)
- [`fix-multi-repository-file-tree-decorations`](changes/archive/2026-07-17-fix-multi-repository-file-tree-decorations/proposal.md)
- [`add-multi-repository-git-commit-workspace`](changes/archive/2026-07-17-add-multi-repository-git-commit-workspace/proposal.md)
- [`hide-git-history-overview-pane`](changes/archive/2026-07-17-hide-git-history-overview-pane/proposal.md)
- [`add-file-view-git-blame`](changes/archive/2026-07-17-add-file-view-git-blame/proposal.md)
- [`fix-multi-repository-file-open-and-blame-scope`](changes/archive/2026-07-17-fix-multi-repository-file-open-and-blame-scope/proposal.md)
- [`fix-multi-repository-git-preview-density`](changes/archive/2026-07-17-fix-multi-repository-git-preview-density/proposal.md)
- [`restore-multi-repository-discard-action`](changes/archive/2026-07-17-restore-multi-repository-discard-action/proposal.md)
- [`fix-global-file-search-hydration`](changes/archive/2026-07-17-fix-global-file-search-hydration/proposal.md)
- [`add-api-endpoint-global-search`](changes/archive/2026-07-17-add-api-endpoint-global-search/proposal.md)
- [`add-git-history-commit-filters`](changes/archive/2026-07-17-add-git-history-commit-filters/proposal.md)
- [`compact-git-history-changed-file-tree`](changes/archive/2026-07-17-compact-git-history-changed-file-tree/proposal.md)
- [`refine-git-history-title-layer-frame`](changes/archive/2026-07-17-refine-git-history-title-layer-frame/proposal.md)
- [`relocate-git-diff-mode-selector-to-right-panel-toolbar`](changes/archive/2026-07-17-relocate-git-diff-mode-selector-to-right-panel-toolbar/proposal.md)
- [`explain-git-pull-option-effects`](changes/archive/2026-07-17-explain-git-pull-option-effects/proposal.md)

The batch created six main capabilities and updated 17 existing capabilities. Shared capability deltas were applied in first-commit order. `fallback-untracked-added-file-empty-inline-diff` required an explicit requirement rename from `Sparse Added-File Facts MUST Preserve Canonical Diff Access` to `Added-File Facts MUST Preserve Conversation Surface Behavior` before its modified delta could sync. Final counts are active=15, archive=626, specs=402; all 402 main specs pass strict validation.

### 2026-07-15 Weekly Code-Change Coverage And Closure Batch

Audited Git history from `2026-07-09 00:00:00 +08:00` through 2026-07-15: 149 total commits, 107 non-merge commits, and 64 commits touching code/build paths. The durable matrix is stored in `openspec/docs/weekly-code-change-openspec-audit-2026-07-15.md`; classification totals are 22 direct change tracked, 12 existing proposal tracked, 18 retrospective backfill, and 12 non-behavior maintenance.

The retrospective change `retro-weekly-code-change-spec-coverage-2026-07-15` added five main capabilities and extended six existing capabilities. New capabilities are `client-localization-language-support`, `terminal-composer-handoff`, `session-history-display-fidelity`, `codex-model-catalog-coverage`, and `client-scrollbar-visual-consistency`.

Archived 13 previously active changes whose task sets were 100% complete:

- `add-downloadable-web-assets`
- `align-codex-message-rendering-with-official`
- `fix-app-shell-composer-startup-convergence`
- `fix-message-math-container-prefix`
- `fix-messages-scroll-anchor-update-loop`
- `fix-sidebar-scroll-area-react19-ref-loop`
- `fix-sidebar-thread-row-provider-startup-loop`
- `fix-tooltip-startup-update-loop`
- `group-global-search-results`
- `harden-message-compact-display-math-boundaries`
- `reduce-idle-chrome-render-cost`
- `restore-added-file-diff-access`
- `unify-conversation-scroll-bottom-convergence`

All archive candidates were synced before move. `reduce-idle-chrome-render-cost` used `--skip-specs` only after all three delta requirement headers were verified to exist exactly once in `ui-chrome-idle-render-cost`. Final counts after archiving the retrospective change: active=12, archive=596, specs=395.

### 2026-07-11 Completion-Based Closure Batch

Archived 18 changes whose task sets were 100% complete and whose individual strict OpenSpec validation passed:

- `reduce-idle-chrome-render-cost`
- `add-idea-style-editable-workspace-diff`
- `fix-claude-manual-compact-wall-clock-cap`
- `add-browser-page-selector-and-window-sizing`
- `fix-streaming-conversation-jank`
- `ratchet-large-file-new-files`
- `restore-git-switch-in-diff-menu`
- `fix-windows-titlebar-drag-latency`
- `fix-non-git-diff-scan-noise`
- `fix-live-auto-follow-rearm-scroll`
- `fix-git-diff-stats-display`
- `fix-editor-file-maximize-and-workspace-file-tabs`
- `fix-diagnostics-idle-cpu-storm`
- `fix-client-store-bloat-and-write-cost`
- `fix-codex-startup-cli-probe`
- `add-workspace-file-compare-tool`
- `add-message-anchor-bottom-jump`
- `add-filetree-root-header-actions`

The archive synced 18 delta sets into main specs, creating four capabilities: `ui-chrome-idle-render-cost`, `conversation-streaming-performance`, `client-storage-performance`, and `workspace-file-compare-tool`. Four initially rejected deltas were calibrated before retry: three new requirements were moved from `MODIFIED` to `ADDED`, and one Browser Dock requirement anchor was aligned to the current main-spec title. Counts after archive: active=12, archive=581, specs=383.

Archive policy for this batch was explicitly completion-based (`tasks=100%` plus strict OpenSpec validation), not a claim that every change had a standalone implementation verification report. In particular, archived historical evidence for `fix-diagnostics-idle-cpu-storm` retains its prior blocked verification note.

### 2026-06-23 v0.5.13 Closure Batch

Archived 9 verified changes and synced their delta specs into main specs:

- `fix-app-shell-startup-react-depth-loop`
- `fix-codex-exec-command-file-change-replay`
- `fix-codex-provider-recovery-binding`
- `fix-message-outline-streaming-jank`
- `fix-provider-model-catalog-and-codex-refresh-isolation`
- `fix-user-input-stale-submit-settlement`
- `refine-home-recent-conversations-ui`
- `relocate-runtime-notice-dock-sidebar-entry`
- `soften-transient-runtime-reconnect-card`

Spec sync summary: 14 existing main specs were updated and no new spec directory was created. Updated capabilities include Codex composer startup selection stability, shell-backed command mutation replay, Codex provider recovery binding, message outline streaming performance, provider-scoped model catalog refresh isolation, stale user-input settlement, home recent conversation visibility, runtime notice dock sidebar placement, and transient runtime reconnect card presentation. Counts after archive: active=4, archive=521, specs=357.

Validation: each archived change passed `openspec validate <change> --strict --no-interactive` immediately before archive. The batch archive used `openspec archive <change> -y`, which synced delta specs before moving each change into `openspec/changes/archive/2026-06-23-*`. During archive, `relocate-runtime-notice-dock-sidebar-entry` required a spec-delta header alignment to match the current main spec requirement names before successful sync.

### 2026-06-18 v0.5.11 Closure Batch

Archived 11 verified changes and synced their delta specs into main specs:

- `fix-runtime-reconnect-card-state-loop`
- `v0511-performance-evidence-and-runtime-jank-hardening`
- `reduce-streaming-reducer-commit-lag`
- `reduce-message-row-render-amplification`
- `reduce-turn-trace-batch-flush-lag`
- `measure-codex-first-delta-latency`
- `measure-codex-turn-start-ack-latency`
- `optimize-governance-sentry-noise-and-large-file-split`
- `fix-disk-codex-empty-draft-fresh-replay`
- `refactor-v0511-thread-messaging-recovery-and-streaming`
- `follow-up-v0511-large-file-cookbook-and-measured-evidence`

Spec sync summary: 25 main specs were created or updated, including v0.5.11 performance evidence, streaming latency diagnostics, Codex message recovery, stale binding recovery, large-file governance, and recovery cookbook capabilities. Counts after archive: active=0, archive=506, specs=353.

Validation: each change passed `openspec validate <change> --strict --no-interactive` immediately before archive. The batch archive used `openspec archive <change> -y`, which synced delta specs before moving each change into `openspec/changes/archive/2026-06-18-*`.

### 2026-05-30 Closure Baseline

The previous workspace snapshot archived 13 completed 0.5.4 changes and synced their delta specs into main specs. The archived set covered foreground settlement diagnostics, persisted client error logs, three-evidence settlement design/implementation/status-query reconciliation, appearance transparency controls, composer input affordance tuning, assistant message tail actions, client runtime environment recovery hardening, close-current-session shortcuts, Web Service workspace path entry, and Codex goal command discovery UX.

### 2026-05-28 Closure Baseline

The earlier closure pass archived 51 explicitly verified active changes across closure batches and synced main specs where the delta had not already been incorporated. This included session management, markdown preview, stale-thread recovery, runtime stability, governance evidence, file reference, email controls, Project Map closure work, performance gates, workspace session catalog, reasoning effort support, composer control surface, file rendering scheduler, and harness/performance governance.

### 2026-06-10 Closure Batch

Archived 15 verified changes across two closure passes and synced their delta specs into main specs:

- `extend-client-font-size-coverage`
- `add-semantic-diff-review`
- `deepen-semantic-diff-review`
- `harden-live-message-canvas-rendering`
- `polish-project-map-files-api-mvp`
- `refine-project-map-api-contract-detail-view`
- `harden-file-markdown-preview-rendering`
- `add-codex-provider-scoped-session-launch`
- `add-prompt-enhancer-manual-provider-timeout`
- `harden-codex-provider-session-catalog-recovery`
- `fix-message-fork-workspace-mutation`
- `fix-browser-context-light-theme-contrast`
- `fix-windows-titlebar-controls-overlap`
- `split-app-shell-runtime-boundaries`
- `unify-client-workflow-runtime-model`

Validation: `openspec validate --specs --strict --no-interactive` passed for all 325 main specs. Full `openspec validate --all --strict --no-interactive` is currently blocked by the pre-existing active change `harden-realtime-composer-status-panel-performance`, which has no spec delta.

### 2026-06-10 P0 Performance Closure Batch

Archived 5 verified P0 performance changes and synced their delta specs into main specs:

- `refresh-v059-performance-baseline`
- `enforce-bundle-budget-gate`
- `harden-file-editor-typing-latency`
- `parallelize-bootstrap-locale-loading`
- `split-startup-css-loading`
- `split-app-shell-performance-boundaries`
- `lazy-markdown-runtime`

Validation: each change passed `openspec validate <change> --strict --no-interactive` before archive. After archive, `openspec validate --specs --strict --no-interactive` passed for all 328 main specs.

## Code Fact Snapshot

Current-branch implementation substrate includes:

- Runtime adapters: Claude Code, Codex CLI, Gemini CLI, and OpenCode. Gemini is enabled by default; OpenCode is optional. OpenCode/Gemini retirement remains an active migration backlog.
- Project intelligence: Project Map / Project X-Ray, Project Memory, Context Ledger, SpecHub, and governance evidence panels.
- Execution surfaces: Task Center / TaskRun, Kanban, Plan panel, Session Activity, runtime log, terminal, Git history, and engine task output inspection.
- Runtime reliability: realtime batching, runtime evidence gates, lifecycle hardening, stalled recovery contracts, global client error log, and startup orchestration.
- Model output safety: shared parser/repair/validator handling is used by Project Map model-JSON flows; this is not a claim that every model response follows that path.
- Cross-platform shell/app behavior: Tauri 2 backend, platform build scripts, Linux startup guard, Windows config, macOS private API/title integration.

This snapshot is evidence-oriented. It does not claim full product QA for every surface. Archive notes must record exact focused tests, manual checks, skipped gates, and platform qualifiers.

## Volatile Fact Sources

易漂移事实必须回到代码或 manifest，不从历史 plan / audit snapshot 反推：

| Fact | Canonical source |
|---|---|
| Product version and npm scripts | `package.json`, `package-lock.json` |
| Tauri product version and bundle | `src-tauri/tauri.conf.json` |
| Rust crate metadata | `src-tauri/Cargo.toml` |
| Runtime engine model | `src/types/engine.ts`, `src-tauri/src/engine/mod.rs`, `src-tauri/src/command_registry.rs` |
| WebView locales | `src/i18n/index.ts`, `src/i18n/locales/*` |
| Theme presets | `src/features/theme/constants/vscodeThemePresets.ts` |
| CI triggers | `.github/workflows/ci.yml` |
| Large-file gates | `scripts/check-large-files.policy.json`, `package.json`, `.github/workflows/large-file-governance.yml` |
| Active/archive/spec inventory | `openspec/changes/*`, `openspec/changes/archive/*`, `openspec/specs/*` |

## Namespace Policy

- Canonical prefix: `spec-hub-*`
- Compatibility prefix: `spec-platform-*` (legacy only; no new requirements)
- New proposals SHOULD use canonical prefixes unless compatibility migration requires otherwise.

## Workflow Governance

- OpenSpec is the source of truth for behavior changes:
  - `openspec/changes/<change-id>/*` defines proposal/design/tasks/spec deltas.
  - behavior changes SHOULD be tracked by an OpenSpec change before implementation.
- Trellis is the execution container for delivery:
  - `.trellis/tasks/*` should map back to one OpenSpec change.
  - implementation and verification should be traceable to linked change artifacts.
- Recommended delivery loop:
  1. Select or create an OpenSpec change.
  2. Create or activate the linked Trellis task.
  3. Implement and verify.
  4. Sync main specs and archive when the change passes gate checks.

## Key Commands

```bash
openspec validate --all --strict --no-interactive
openspec status --change <change-id>
find openspec/specs -mindepth 1 -maxdepth 1 -type d | wc -l
find openspec/changes -mindepth 1 -maxdepth 1 -type d ! -name archive | wc -l
find openspec/changes/archive -mindepth 1 -maxdepth 1 -type d | wc -l
npm run typecheck
npm run lint
npm run test
npm run check:runtime-contracts
npm run check:large-files
```

## Maintenance Boundaries

- `openspec/README.md` stays concise and navigation-oriented.
- `openspec/project.md` keeps durable governance context and current inventory only.
- `openspec/changes/README.md` keeps the active proposal index; `openspec/changes/archive/README.md` keeps the complete archived proposal index.
- `openspec/specs/README.md` indexes all mainline capability contracts; `openspec/docs/README.md` separates durable references from dated evidence.
- High-drift implementation evidence, commit matrices, and temporary backfill snapshots should live in the relevant change artifacts or archive notes, not here.
- Host-specific session-start logic belongs in `.claude/**` or `.codex/**`, not in OpenSpec workspace docs.
- Product-facing overview belongs in `README.md` and `README.zh-CN.md`, not in OpenSpec change artifacts.

## Owners

- ccgui contributors

## Update History

- 2026-07-17: Re-audited project documentation against manifests, workflows, and current code; refreshed the working-tree inventory to active=11, archive=631, specs=403; added complete docs/OpenSpec navigation indexes; corrected runtime, locale, storage, CI, and workflow facts; and repaired project-owned documentation links. No business code was modified.
- 2026-07-17: Added a two-level proposal index linking all 10 active and 631 archived changes, connected the root/OpenSpec navigation surfaces, and refreshed current planning context to product version 0.7.5 with active=10, archive=631, specs=403. Historical snapshot counts were preserved.
- 2026-07-17: Archived five near-complete changes after evidence review: two reached full task closure, while three retained explicit manual QA gaps under a user-authorized waiver. Synced one new and six existing main capabilities, calibrated one stale cross-capability delta, and refreshed counts to active=10, archive=631, specs=403. No product code was modified.
- 2026-07-17: Archived 22 verified Git, search, file-view, conversation, and Codex changes; synced six new and 17 existing main capabilities; calibrated one stale requirement rename; and refreshed tracked counts to active=15, archive=626, specs=402. All 402 main specs pass strict validation, and no product code was modified.
- 2026-07-15: Audited one week of code/build history, backfilled 18 proposal gaps through one capability-oriented retrospective change, synced five new and six modified capability specs, archived 13 completed active changes plus the retrospective change, and refreshed tracked counts to active=12, archive=596, specs=395. No product code was modified.
- 2026-07-11: Completed a documentation-only calibration pass. Added missing designs for Linux native-menu localization and Claude runtime MCP servers, added seven evidence-oriented verification reports, and restored two empty sidebar loading changes with proposal/design/tasks/spec deltas. No product code, configuration, scripts, or tests were modified; both restored changes remain 0% complete pending implementation/evidence review.
- 2026-07-11: Archived 18 completion-based changes, synced their delta specs, calibrated four stale delta anchors/sections, and refreshed the active backlog to 12 changes. Current tracked counts are active=12, archive=581, specs=383.
- 2026-06-23: Archived 9 verified v0.5.13 changes and synced their deltas into main specs. Current tracked counts are active=4, archive=521, specs=357. Remaining active set is one in-progress release pipeline cache change plus three demand-pool proposals without `tasks.md` or spec deltas.
- 2026-06-12: Reconciled active OpenSpec workspace after code rollback. Active changes are the five P1 performance chain changes: `composer-and-message-row-render-budget`, `renderer-resource-backpressure`, `backend-io-cache-and-bridge-payload-budget`, `workspace-tree-and-large-file-listing-budget`, and `markdown-off-main-thread-pipeline`. Current tracked counts are active=5, archive=472, specs=328. Each active change validates individually under strict mode.
- 2026-06-11: Archived `lazy-markdown-runtime` after moving full Markdown parser dependencies behind `FullMarkdownRuntime`, preserving focused Markdown behavior tests, and syncing message markdown streaming compatibility deltas. Current tracked counts are active=3, archive=469, specs=328. Spec-only strict validation passed.
- 2026-06-11: Archived `split-app-shell-performance-boundaries` after removing AppShell `@ts-nocheck`, deferring release notes changelog data into a lazy chunk, and syncing app-shell runtime boundary deltas. Current tracked counts are active=4, archive=468, specs=328. Spec-only strict validation passed.
- 2026-06-10: Archived 2 additional startup P0 performance changes after user-run manual QA and synced their deltas into main specs. Current tracked counts are active=5, archive=467, specs=328. Spec-only strict validation passed.
- 2026-06-10: Archived 3 verified P0 performance changes and synced their deltas into main specs. Current tracked counts were active=7, archive=465, specs=327. Spec-only strict validation passed.
- 2026-06-10: Reconciled the active P0 performance workspace against dirty code evidence. Active changes were tracked as 10 total before archiving: 3 closure candidates, 3 near-complete or partially implemented changes, and 4 implementation backlog changes. Added an explicit closure order and attribution note.
- 2026-06-10: Archived 8 additional verified changes and synced their deltas into main specs. Current tracked counts are active=8, archive=459, specs=325. Spec-only strict validation passed; full strict validation remains blocked by active change `harden-realtime-composer-status-panel-performance` missing deltas.
- 2026-06-10: Archived 7 verified changes and synced their deltas into main specs. Current tracked counts are active=5, archive=451, specs=320. Spec-only strict validation passed; full strict validation remains blocked by active change `harden-realtime-composer-status-panel-performance` missing deltas.
- 2026-06-06: Stage-writeback refresh. Active change list corrected to the current seven active directories. `add-project-map-api-contract-view` and `add-intent-canvas-workspace-files` proposal/design artifacts received stage assessment and implementation calibration notes. Archive/main spec counts were intentionally not refreshed in this pass.
- 2026-06-01: Refreshed project documentation snapshot. Current counts were active=2, archive=402, specs=303. Active changes were `add-agent-task-orchestration-center` and `harden-model-structured-output-normalization`; the former remained 0.5.5 planning/execution work, while the latter was completed active work pending archive/closure decision.
- 2026-05-30: Archived 13 completed 0.5.4 changes after syncing delta specs into main specs. Previous workspace counts were active=2, archive=391, specs=299.
- 2026-05-28: Archived `fix-user-input-dismiss-settlement` after strict OpenSpec validation, focused Vitest coverage, typecheck, and lint. Previous workspace counts were active=4, archive=370, specs=291.
- 2026-05-28: Archived 20 verified changes from `feature/v0.5.4`, including the Project Map verified closure set, runtime performance evidence gates, workspace session catalog, reasoning-effort support, composer control surface, file rendering scheduler, and harness/performance governance changes.
