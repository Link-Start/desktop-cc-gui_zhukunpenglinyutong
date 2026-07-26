## ADDED Requirements

### Requirement: File read failures MUST stop loading and surface the error

When `useFileDocumentState` fails to read a file for any reason, the returned `isLoading` MUST become `false` and the `error` MUST contain a human-readable message. The UI MUST render the error instead of remaining in an infinite "loading file" state.

#### Scenario: read_workspace_file rejects on Windows external plan file

- **GIVEN** a file tab is opened for a path that the backend rejects (for example, an external absolute path outside allowed roots)
- **WHEN** the backend command returns an error such as "Path is not within allowed directories."
- **THEN** the frontend hook MUST set `isLoading` to `false` and `error` to the returned message
- **AND** `FileViewBody` MUST display the error instead of the "正在加载文件..." placeholder

#### Scenario: user edits while a slow read is still in flight

- **GIVEN** a file read is in progress and has not yet resolved
- **WHEN** the user edits the document before the read completes
- **THEN** the hook MUST keep the user's local draft
- **AND** once the read resolves, `isLoading` MUST become `false` so the UI does not remain stuck
