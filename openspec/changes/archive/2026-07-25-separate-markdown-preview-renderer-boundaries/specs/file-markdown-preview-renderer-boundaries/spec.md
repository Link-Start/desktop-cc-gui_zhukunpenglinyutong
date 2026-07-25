## ADDED Requirements

### Requirement: File Markdown preview MUST expose one canonical production router

Production file-preview consumers MUST import `FileMarkdownPreview` from
`FileMarkdownPreview.tsx`. The canonical router MUST own renderer profile selection,
outline orchestration, and fast-to-rich fallback.

#### Scenario: FileView renders Markdown

- **WHEN** `FileViewBody` renders a Markdown preview
- **THEN** it mounts the canonical `FileMarkdownPreview`
- **AND** it does not import the compatibility Fast entry

### Requirement: Rich renderer MUST have an explicit one-way boundary

The ReactMarkdown implementation MUST be exported as `FileMarkdownPreviewRich` from
`FileMarkdownPreviewRich.tsx`. It MUST NOT import the canonical router or compatibility
entry. The canonical router MAY import the rich implementation as its fallback.

#### Scenario: Fast renderer requests fallback

- **WHEN** fast compilation, sanitization, profile validation, or a local-image guard requests fallback
- **THEN** the canonical router mounts `FileMarkdownPreviewRich`
- **AND** existing annotation, outline, and cache-reset contracts remain available

### Requirement: Legacy Fast symbol MUST contain no renderer logic

`FileMarkdownPreviewFast.tsx` MAY remain as a compatibility entry, but it MUST only
re-export the canonical router and compatible prop type.

#### Scenario: Existing test imports the Fast symbol

- **WHEN** an existing caller imports `FileMarkdownPreviewFast`
- **THEN** it receives the canonical router
- **AND** no duplicate router state or fallback implementation exists
