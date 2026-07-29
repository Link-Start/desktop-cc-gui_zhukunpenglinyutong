# Verification

## Summary

| Dimension | Result |
|---|---|
| Completeness | 7/7 tasks complete |
| Correctness | 1 modified requirement / 4 scenarios mapped to code and tests |
| Consistency | Implementation follows the single-focus-surface two-pane design |

## Requirement Evidence

### Provider Model Lists MUST Expand Mutually Exclusively

- `ModelSelect.tsx` renders Shared `targetGroups` in one
  `DropdownMenuContent` with `data-shared-target-cli-list` and
  `data-shared-target-provider-panel`.
- Shared path no longer creates `DropdownMenuSubContent`; legacy
  `modelGroups` remains unchanged.
- `activeTargetGroupId` controls the right panel without changing
  `ExecutionTarget`.
- `expandedProviderProfileKey` remains the only Provider accordion state.
- Model rows remain the only terminal action and close the root menu after
  `onExecutionTargetChange`.

## Test Evidence

- `ModelSelect.test.tsx` asserts one menu root and no
  `dropdown-menu-sub-content` in Shared mode.
- Tests cover CLI activation, Provider A/B mutual exclusion, repeated
  collapse/expand, terminal Model selection, Native inline Providers, and
  legacy grouped models.
- Focused Vitest: 17/17 passed.
- Target ESLint: passed.
- TypeScript typecheck: passed.
- Runtime contracts: passed.
- OpenSpec strict validation: passed.

## Manual Evidence

- 2026-07-28：用户在 Shared Session 实机验证双栏模式，确认原失焦/无法折叠问题已解决，
  并授权立即提交。

## Verdict

No CRITICAL, WARNING, or SUGGESTION findings. Ready for sync, archive, and commit.
