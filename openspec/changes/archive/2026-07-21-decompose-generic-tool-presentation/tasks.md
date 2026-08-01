## 1. Lock Variants

- [x] 1.1 Audit existing coverage for completed/processing/failed and unknown fallback.
- [x] 1.2 Add focused regression cases for any uncovered ExitPlan, file-change, image-view, or heavy-output contract.

## 2. Pure Presentation Model

- [x] 2.1 Add failing tests for `buildGenericToolPresentation` variant models.
- [x] 2.2 Extract parser/projection helpers into `genericToolPresentation.ts` without React/i18n imports.
- [x] 2.3 Make `GenericToolBlock` consume one presentation model per item.

## 3. Specialized Content

- [x] 3.1 Extract `ExitPlanToolContent` with copy/execution actions preserved.
- [x] 3.2 Extract `FileChangeToolContent` with path/diff/stat behavior preserved.
- [x] 3.3 Extract `ImageViewToolContent` with preview/fallback behavior preserved.
- [x] 3.4 Keep common marker shell, expansion, canonical copy, hydration and dispatch in `GenericToolBlock`.

## 4. Verification

- [x] 4.1 Run focused builder/component tests and messages/tool suites.
- [x] 4.2 Run typecheck, lint, build, runtime/bundle/boundary gates and strict validation.
- [x] 4.3 Record line-count change, independent review, and baseline qualifiers in `verification.md`.
