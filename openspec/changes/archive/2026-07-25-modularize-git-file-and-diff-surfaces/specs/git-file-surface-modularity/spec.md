## ADDED Requirements

### Requirement: Git and file surfaces preserve capability ownership

The application SHALL keep high-churn Git/File production and test entry files below their applicable large-file hard threshold by extracting complete capability slices rather than moving arbitrary line ranges.

#### Scenario: Large-file gate evaluates target surfaces

- **WHEN** the targeted large-file check evaluates `GitDiffPanel`, `FileViewPanel`, and their primary test files
- **THEN** none of those four files exceeds its applicable hard threshold

### Requirement: AI commit generation uses one orchestration contract

Git Changes and Git History Worktree SHALL invoke a shared AI commit generation controller while preserving repository scope, engine selection, language selection, sanitization, loading, and error behavior.

#### Scenario: User selects engine and language

- **WHEN** a user generates a commit message from either surface
- **THEN** the shared controller receives the selected engine, language, and scoped changes

### Requirement: Diff surfaces share presentation data without sharing policy

Editable, review, and read-only diff surfaces SHALL consume a shared presentation model for common file metadata while retaining their own editing, annotation, and toolbar policies.

#### Scenario: A diff entry includes media metadata

- **WHEN** a surface normalizes a text or image diff entry
- **THEN** path, status, diff, and optional media metadata follow the same presentation contract
