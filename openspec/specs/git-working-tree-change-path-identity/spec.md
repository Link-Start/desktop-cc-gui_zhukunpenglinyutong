# git-working-tree-change-path-identity Specification

## Purpose

Define canonical source/destination path identity for Git working-tree changes so status, activation, diff projection, and mutations remain consistent across Desktop and daemon backends.

## Requirements

### Requirement: Git status MUST preserve working-tree change path identity

Git status payload MUST represent a rename as a two-path change without making existing callers abandon the canonical `path` field.

#### Scenario: staged rename uses index destination

- **WHEN** libgit2 reports an `INDEX_RENAMED` entry from `oldPath` to `newPath`
- **THEN** the staged `GitFileStatus.path` MUST equal normalized `newPath`
- **AND** `GitFileStatus.oldPath` MUST equal normalized `oldPath`

#### Scenario: unstaged rename uses workdir destination

- **WHEN** libgit2 reports a `WT_RENAMED` entry from `oldPath` to `newPath`
- **THEN** the unstaged `GitFileStatus.path` MUST equal normalized `newPath`
- **AND** `GitFileStatus.oldPath` MUST equal normalized `oldPath`

#### Scenario: non-rename payload remains compatible

- **WHEN** status is added, modified, deleted, typechanged, conflicted, or untracked
- **THEN** the existing `path`, `status`, `additions`, and `deletions` fields MUST remain available
- **AND** `oldPath` MUST be optional

### Requirement: Git changed-file activation MUST respect current-file availability

Git panel activation MUST open a live workspace file only when the status identity refers to a current file.

#### Scenario: single-repository rename opens destination

- **WHEN** user activates a rename row whose `path` is the destination and whose `oldPath` is the source
- **THEN** the ordinary editor open flow MUST receive the destination `path`
- **AND** it MUST NOT request the removed source path

#### Scenario: multi-repository rename preserves repository scope

- **WHEN** user activates a rename row inside a nested repository
- **THEN** the editor target MUST combine that row's `repositoryRoot` with the destination `path`
- **AND** another repository containing the same relative path MUST NOT receive the request

#### Scenario: deleted row opens read-only diff

- **WHEN** user activates a changed-file row with status `D`
- **THEN** the Git panel MUST open the existing repository-scoped diff preview
- **AND** it MUST NOT invoke ordinary workspace file open for the deleted path
- **AND** the review MUST remain non-editable

#### Scenario: mouse and keyboard activation remain equivalent

- **WHEN** user activates the same rename or deleted row by ordinary mouse click, Enter, or Space
- **THEN** every activation method MUST resolve the same repository-scoped target
- **AND** keyboard activation MUST NOT bypass rename editor routing or deleted read-only preview routing

### Requirement: Desktop and daemon MUST preserve Git rename parity

Desktop Tauri and daemon/Web Service Git implementations MUST emit and mutate the same rename identity.

#### Scenario: status payload parity

- **WHEN** the same staged or unstaged rename is read through Desktop and daemon backends
- **THEN** both payloads MUST expose the same destination `path` and source `oldPath`

#### Scenario: rename mutation covers both paths

- **WHEN** stage, unstage, or discard is requested using either side of a detected rename
- **THEN** Desktop and daemon MUST apply the operation to the normalized source and destination paths
- **AND** the operation MUST NOT leave the other rename side behind solely because status `path` uses the destination

#### Scenario: chained rename mutation honors command layer

- **WHEN** HEAD-to-Index reports `a → b` and Index-to-Workdir reports `b → c`
- **THEN** stage and discard MUST resolve the Workdir pair `b + c`
- **AND** unstage MUST resolve the Index pair `a + b`
- **AND** neither command MUST select a pair solely because another layer was scanned first

### Requirement: Git diff projection MUST preserve rename identity

Working-tree diff, stats, and full-diff responses MUST consume rename-aware deltas before frontend canonical projection.

#### Scenario: unchanged or modified rename remains one row

- **WHEN** a tracked file is renamed with zero or partial content edits
- **THEN** Desktop and daemon diff responses MUST emit one canonical rename delta using the destination path
- **AND** frontend reconciliation MUST NOT synthesize an additional old-path deleted fallback row

#### Scenario: rename stats use both aliases

- **WHEN** status stats or full-diff is requested for a rename destination
- **THEN** the diff scope MUST include the connected source and destination paths
- **AND** content stats MUST describe the rename edit rather than an unrelated whole-file addition caused by destination-only pathspec
