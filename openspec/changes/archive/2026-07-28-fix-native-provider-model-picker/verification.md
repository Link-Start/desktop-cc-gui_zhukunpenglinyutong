# Verification

## Summary

| Dimension | Result |
|---|---|
| Completeness | 8/9 implementation tasks complete before final verification |
| Correctness | 5 requirements / 12 scenarios mapped to implementation and focused tests |
| Consistency | Implementation follows design decisions D1–D5 |

## Requirement Evidence

### Native Model Selector MUST Be Scoped To Its Current CLI Providers

- Implementation:
  - `useSharedProviderTargetCatalog.ts`: `mode="native"` projects only `currentProvider`.
  - `ChatInputBox.tsx`: Claude/Codex/Kimi Native Sessions use Provider target groups instead of legacy cross-CLI `modelGroups`.
- Tests:
  - Native Codex returns one CLI group.
  - Native Kimi keeps only the current Profile selectable.

### Provider Model Lists MUST Expand Mutually Exclusively

- Implementation:
  - `ModelSelect.tsx`: one `expandedProviderProfileKey`; activating a Profile replaces the previous key.
  - Profile trigger exposes `aria-expanded` and uses Radix menu keyboard selection.
- Tests:
  - Opening Provider B collapses Provider A and removes A models from the visible menu.

### Native Provider Model Selection MUST Preserve Binding Semantics

- Implementation:
  - `isSameProviderExecutionProfile` normalizes local/disk sentinel and `null`.
  - Same Profile calls `onModelSelect`; different Profile calls `onNativeProviderTargetChange` without changing active engine/model.
- Tests:
  - local sentinel equals canonical default binding.
  - managed Provider A/B compare as different bindings.

### Composer Provider Selection MUST Reuse Provider Continuation

- Implementation:
  - `providerContinuationRequests.ts`: typed, cleanup-safe feature request channel.
  - `Composer.tsx`: freezes destination Provider + Model into the request.
  - `useSidebarMenus.ts`: context menu and Composer share `prepareProviderContinuationDialog`.
  - Operation identity includes Provider, Model, and Reasoning to avoid immutable-request conflicts.
- Tests:
  - Composer request includes destination Model.
  - Existing Dialog receives source/target identity and has no command side effect before confirm.
  - Different target Models receive different operation ids.
  - Existing cancel/degraded/recovery tests remain green.

## Commands

- `npx vitest run <8 focused suites>`: PASS — 8 files, 129 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with 8 pre-existing warnings outside touched files; 0 errors.
- `npm run check:runtime-contracts`: PASS.
- `git diff --check`: PASS.
- `openspec validate fix-native-provider-model-picker --strict --no-interactive`: PASS.

## Cross-Layer Review

- UI → request channel → existing Dialog controller → existing Tauri service payload preserves
  `workspaceId`, source Session identity, Provider Profile, Model, Reasoning and capability fingerprint.
- No Rust/Tauri command or persisted schema changed.
- Listener cleanup is returned from `useEffect`; request channel owns no durable state.
- Catalog requests remain Provider-scoped and lazy; no polling or AppShell root state was added.
- Shared Session CLI picker and Native context-menu continuation remain covered by existing tests.

## Verdict

No CRITICAL, WARNING, or SUGGESTION findings. Ready for OpenSpec sync/archive after the final
task checkbox is updated.
