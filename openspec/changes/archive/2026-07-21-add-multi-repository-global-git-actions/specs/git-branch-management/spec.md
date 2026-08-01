## ADDED Requirements

### Requirement: Frontend checkout orchestration supports explicit repository scope
Frontend branch checkout orchestration MUST accept an optional explicit repository root so callers can target each discovered repository without mutating global repository selection.

#### Scenario: Explicit nested repository checkout
- **WHEN** a checkout caller supplies a non-empty `repositoryRootOverride`
- **THEN** the existing checkout command SHALL receive that exact repository root and requested branch
- **AND** no other repository SHALL be used as fallback

#### Scenario: Explicit workspace-root checkout
- **WHEN** a checkout caller supplies `repositoryRootOverride=""`
- **THEN** the existing checkout command SHALL target the workspace-root repository
- **AND** the empty string MUST NOT be converted to an omitted scope

#### Scenario: Legacy checkout caller omits override
- **WHEN** an existing checkout caller omits `repositoryRootOverride`
- **THEN** checkout SHALL continue using the hook's currently selected repository scope

#### Scenario: Scoped checkout rejects
- **WHEN** the existing checkout command rejects because the branch is unavailable or working-tree state blocks checkout
- **THEN** the error SHALL propagate to the orchestration caller for repository-level attribution
