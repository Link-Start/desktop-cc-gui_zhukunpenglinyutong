## 1. PNG Export Core

- [x] 1.1 [P0, depends: none] Replace the unused SVG download helper with a feature-local SVG Data URL → bounded 2x PNG exporter; input is raw SVG plus normalized Data URL, output is a downloaded `mermaid-diagram.png`; verify dimensions, MIME, aspect-ratio cap, anchor cleanup, and Object URL revoke with unit tests.

## 2. Fullscreen Viewer Integration

- [x] 2.1 [P0, depends: 1.1] Add the shared bottom-right download control and pending/error state to `MermaidFullscreenViewer`; input is the current viewer SVG/cache, output is one recoverable export action shared by messages and files; verify no concurrent export and viewer remains open on failure.
- [x] 2.2 [P1, depends: 2.1] Add feature-scoped themed CSS and all locale strings; output is a responsive, accessible control above the fullscreen viewer; verify accessible name, localized pending/error text, z-index, and existing 8-action toolbar stability.

## 3. Verification And Contract Closure

- [x] 3.1 [P0, depends: 2.1, 2.2] Run focused Mermaid fullscreen/export tests and fix regressions; required output is passing helper, component, message-surface, and file-surface suites.
- [x] 3.2 [P0, depends: 3.1] Run `npm run typecheck`, scoped lint, `openspec validate --change add-mermaid-fullscreen-png-download --strict`, and inspect the final diff; output is zero blocking diagnostics and implementation/spec alignment.
