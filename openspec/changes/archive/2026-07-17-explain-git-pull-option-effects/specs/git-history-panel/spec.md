## ADDED Requirements

### Requirement: Pull option explanations track current selection

The Git History Pull Dialog SHALL dynamically explain the effect of the currently selected Pull options without
changing option selection or execution behavior.

#### Scenario: Explain default pull behavior

- **WHEN** Pull Dialog is open without an explicit strategy or additive option
- **THEN** the details area SHALL explain that remote changes are fetched and integration follows applicable Git configuration
- **AND** the details area SHALL NOT promise a specific merge or rebase result

#### Scenario: Explain one selected strategy

- **WHEN** user selects one of `--rebase`, `--ff-only`, `--no-ff`, or `--squash`
- **THEN** `Intent`, `Will Happen`, and `Will NOT Happen` SHALL update from the current selection
- **AND** the explanation SHALL describe history shape, commit behavior, and relevant failure or manual-follow-up behavior
- **AND** `--no-ff` and `--squash` SHALL be described as merge-path effects that do not by themselves
  override an applicable Git rebase configuration

#### Scenario: Explain additive options in strategy context

- **WHEN** user selects `--no-commit` or `--no-verify`
- **THEN** the details area SHALL explain the option in the context of the currently selected strategy
- **AND** merge-only, redundant, or no-additional-effect combinations SHALL be stated explicitly

#### Scenario: Explain representative combined selections

- **WHEN** user selects a combination such as `--no-ff --no-commit`, `--ff-only --no-commit`,
  `--squash --no-commit`, or `--rebase --no-commit --no-verify`
- **THEN** the details area SHALL describe the combined outcome rather than concatenate context-free definitions
- **AND** selected chips and command preview SHALL continue to show the original option combination

#### Scenario: Keep explanation synchronized after removal

- **WHEN** user deselects an option or removes a selected option chip
- **THEN** the details area and command preview SHALL immediately reflect the remaining selection
- **AND** no Pull command SHALL execute before confirmation

#### Scenario: Preserve pull execution behavior

- **WHEN** dynamic Pull explanations are rendered
- **THEN** option availability, selection state, request payload, Git argument ordering, confirmation, and execution SHALL remain unchanged

### Requirement: Pull options and final command are visually discoverable

The Git History Pull Dialog SHALL expose modification options and visually distinguish the final command without
changing option or execution semantics.

#### Scenario: Show modification options when the dialog opens

- **WHEN** user opens the Pull Dialog
- **THEN** all Pull option controls SHALL be visible without an additional click
- **AND** the existing toggle SHALL continue to allow manual collapse and expansion

#### Scenario: Color command tokens without changing the command

- **WHEN** the Pull command preview or `Example` is rendered
- **THEN** command, remote, target branch, and selected options SHALL have visually distinguishable token styling
- **AND** both surfaces SHALL expose the same complete, naturally readable command string and option ordering as before
- **AND** technical command tokens SHALL opt out of automatic translation without assigning a prohibited
  accessible name to `code` or generic elements

#### Scenario: Announce dynamic option effects

- **WHEN** the selected Pull option combination changes
- **THEN** the current effect summary SHALL be exposed as a polite atomic status update
- **AND** the visible `Intent`, `Will Happen`, and `Will NOT Happen` structure SHALL remain unchanged

#### Scenario: Color Fetch, Sync, and Push operation surfaces

- **WHEN** Fetch, Sync, or Push dialog renders a framed command, branch route, ahead/behind summary, or target branch value
- **THEN** command, operator, remote, branch, option, and summary roles SHALL use the shared Git operation color language
- **AND** the rendered natural text, input value, i18n copy, command ordering, selection state, request payload, and execution behavior SHALL remain unchanged
