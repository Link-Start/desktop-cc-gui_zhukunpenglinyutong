## Context

`useWorktreePrompt.openPrompt` currently creates a random `codex/<date>-<suffix>` branch name before opening the dialog. The dialog already owns a required branch input, user guidance, Git ref validation, and disabled-submit state. No canonical task-purpose fact is available at this boundary.

## Goals / Non-Goals

**Goals:**

- Remove engine-biased, non-semantic branch defaults
- Require explicit user branch intent through the existing field
- Preserve all other worktree creation behavior

**Non-Goals:**

- Add a purpose field or AI slug generator
- Infer `feat`/`fix` or transliterate Chinese
- Change backend worktree commands or payloads

## Decisions

### 1. Initialize branch to an empty string

`openPrompt` sets `branch: ""`. Existing `branchError`, `canSubmit`, and `confirmPrompt` guards remain the single validation path.

Alternative: add a purpose input and generate a slug. Rejected because it duplicates user input and introduces synchronization/i18n policy without a current requirement.

Alternative: use an engine-neutral generated name. Rejected because it removes `codex/` bias but remains semantically empty.

### 2. Keep user input authoritative

Once the user enters a valid branch, the existing payload passes it unchanged to `addWorktreeAgent`. No normalization or silent rewrite is added.

## Risks / Trade-offs

- [Trade-off] Creation requires extra typing → Existing examples already show semantic branch patterns and make the required action clear
- [Risk] Tests depend on random default shape → Update focused tests to assert empty initial state and existing required guard

## Migration Plan

1. Remove generated default from `openPrompt`
2. Update focused hook/component tests
3. Run lint, typecheck, tests, and strict OpenSpec validation

Rollback restores the generated default. No stored data or backend migration exists.

## Open Questions

None.
