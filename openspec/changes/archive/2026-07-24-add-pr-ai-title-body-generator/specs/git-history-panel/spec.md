## ADDED Requirements

### Requirement: Create PR Dialog AI Trigger UI

The Create PR dialog SHALL provide AI auto-generation affordances on the PR title field with a single trigger.

#### Scenario: Single trigger placement

- **WHEN** the Create PR dialog renders
- **THEN** exactly ONE button displaying the current engine icon SHALL appear adjacent to the PR title input
- **AND** NO button SHALL appear on the PR body textarea
- **AND** clicking the button SHALL open the engine/language selection menu
- **AND** the button SHALL be disabled while generation is in flight or while prerequisites are missing

#### Scenario: Wrapper uses non-label elements

- **WHEN** the field containers render
- **THEN** the wrappers (`git-history-create-branch-field`, `is-pr-content-row`) SHALL be `<div>` elements
- **AND** inner text labels SHALL be `<span>` elements
- **AND** NO `<label>` element SHALL be nested with a `<button>` (browser forwards the click to the associated form control, which prevents the button's `onClick` from firing)
- **AND** the title input and body textarea SHALL retain localized accessible names through `aria-label`

#### Scenario: Loading indicator with elapsed counter

- **WHEN** the AI generator is running
- **THEN** the trigger button icon SHALL spin
- **AND** the input/textarea SHALL be disabled
- **AND** a blue progress pill SHALL appear with text from `historyGeneratePrLoading` containing the elapsed-second counter `{{elapsed}}`
- **AND** the counter SHALL update every 1 second

#### Scenario: 60s slow warning

- **WHEN** the AI generator has been running for 60+ seconds
- **THEN** the progress pill SHALL switch to an amber variant with text from `historyGeneratePrLoadingSlow`
- **AND** the pill SHALL include a "diff large" hint and continue the elapsed counter

#### Scenario: Success indicator

- **WHEN** AI generation completes successfully
- **THEN** a green success pill SHALL appear with text from `historyGeneratePrSuccessWithEngine` containing the engine name `{{engine}}` (e.g. "✓ Claude 已生成 PR 标题与正文")
- **AND** the title input and body textarea SHALL flash a 1.2s accent outline via `[data-ai-flash-at]` attribute
- **AND** the success pill SHALL auto-dismiss after 3 seconds

#### Scenario: Error display

- **WHEN** the AI generator returns an error or times out
- **THEN** the error message SHALL appear as a red pill (`git-history-create-pr-generation-error`)
- **AND** the localized error SHALL map to one of `historyGeneratePrTimeout` / `historyGeneratePrUnsupportedEngine` / `historyGeneratePrMissingBaseOrHead` / `historyGeneratePrError`
- **AND** the error SHALL NOT overwrite user-entered content

#### Scenario: Language and engine menu parity

- **WHEN** the user clicks the trigger button
- **THEN** the menu SHALL expose Codex / Claude options and Chinese / English options
- **AND** the last-used configuration SHALL be available as a quick-action entry
- **AND** i18n keys SHALL cover `historyGeneratePrMenuTitle`, `historyGeneratePrMenuLastConfig`, `historyGeneratePrMenuCodex`, `historyGeneratePrMenuClaude`, `historyGeneratePrMenuZh`, `historyGeneratePrMenuEn`

### Requirement: Shared Context Menu Opaque Styling

The shared `RendererContextMenu` component SHALL render with an opaque background matching the active theme to prevent visual bleed-through from overlapping surfaces.

#### Scenario: Opaque menu background

- **WHEN** any consumer of `RendererContextMenu` renders (sidebar workspace menu, terminal panel, git diff menu, PR content menu)
- **THEN** the menu background SHALL use `var(--surface-sidebar-opaque)` (fully opaque in every theme)
- **AND** the menu SHALL NOT apply `backdrop-filter` (which samples pixels from behind the menu and can leak shadows from overlapping dialogs)
