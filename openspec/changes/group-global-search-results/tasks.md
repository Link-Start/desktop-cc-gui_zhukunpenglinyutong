## 1. File Result Contract

- [x] 1.1 [P0][depends:none][I: file paths from files provider][O: basename-only title while preserving full `filePath` and `locationLabel`][V: focused provider Vitest] Implement cross-platform file title projection.
- [x] 1.2 [P0][depends:1.1][I: POSIX and Windows path fixtures][O: regression assertions for title and full-path fields][V: focused provider Vitest] Cover file result contract edge cases.

## 2. Layered Result Presentation

- [x] 2.1 [P0][depends:none][I: flat ranked `SearchResult[]`][O: non-empty kind groups preserving original result indexes and group-relative order][V: SearchPalette Vitest] Implement presentation-only grouping.
- [x] 2.2 [P1][depends:2.1][I: grouped projection][O: i18n section headings and theme-compatible layered list CSS][V: component assertions plus visual DOM inspection] Render and style result sections.
- [x] 2.3 [P0][depends:2.1][I: selection crossing group boundaries][O: active row and Enter action remain bound to original flat index][V: SearchPalette Vitest] Protect keyboard selection continuity.

## 3. Verification

- [x] 3.1 [P0][depends:1.2,2.2,2.3][I: implementation][O: focused tests, typecheck, lint and large-file results][V: commands exit 0] Run frontend quality gates.
- [x] 3.2 [P0][depends:3.1][I: completed implementation and artifacts][O: strict OpenSpec validation and verification report][V: `openspec validate` and verify workflow] Close implementation evidence.

## 4. Section Header Follow-up

- [x] 4.1 [P1][depends:2.2][I: visually weak section headings][O: full-width sticky header band with stronger hierarchy and theme tokens][V: SearchPalette component/CSS contract test] Strengthen section separation.
- [x] 4.2 [P0][depends:4.1][I: follow-up implementation][O: refreshed frontend and OpenSpec evidence][V: focused tests, typecheck, lint, strict validation] Re-verify the search change.
