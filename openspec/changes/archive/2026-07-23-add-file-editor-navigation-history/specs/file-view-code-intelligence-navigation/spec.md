## ADDED Requirements

### Requirement: File Editor MUST Retain Scoped Cross-File Semantic Navigation History

File Editor MUST retain an ordered, in-memory history for cross-file locations reached through definition、implementation 或 references navigation，并 MUST preserve both source and target `path + line + column` locations.

#### Scenario: Traverse a semantic navigation chain backward and forward

- **GIVEN** 用户依次从 `A` semantic navigate 到 `B`，再从 `B` navigate 到 `C`
- **WHEN** 用户连续触发 Back
- **THEN** File Editor MUST 依次恢复 `B` 与 `A` 的 file、line、column
- **AND** subsequent Forward MUST 依次恢复 `B` 与 `C`

#### Scenario: New semantic jump truncates the forward branch

- **GIVEN** history 为 `A -> B -> C` 且用户已 Back 到 `B`
- **WHEN** 用户从 `B` semantic navigate 到 `D`
- **THEN** history MUST 收敛为 `A -> B -> D`
- **AND** `C` MUST NOT remain reachable through Forward

#### Scenario: Same-file semantic positioning does not create history

- **WHEN** definition、implementation 或 references navigation target 与 source 属于同一 file
- **THEN** File Editor MUST perform the existing positioning behavior
- **AND** MUST NOT append a cross-file history entry

### Requirement: Semantic Navigation History MUST Remain Isolated From General File Activity

Semantic navigation history MUST NOT ingest or control file tree open、global search open、manual tab activation、ordinary cursor movement 或 detached explorer sidebar behavior.

#### Scenario: Manual file activation ends the active semantic chain

- **GIVEN** 当前存在 semantic navigation history
- **WHEN** 用户通过 tab、file tree 或其他 non-semantic surface 激活另一个 file
- **THEN** File Editor MUST clear the active semantic history chain
- **AND** the manual activation MUST NOT become a Back / Forward destination

#### Scenario: Editor lifecycle reset clears history

- **WHEN** 用户关闭 File Editor 或切换 workspace
- **THEN** navigation history MUST be discarded
- **AND** a later Editor lifecycle MUST start with Back and Forward unavailable

#### Scenario: Detached explorer keeps its leading sidebar action

- **WHEN** FileViewPanel is rendered in Detached File Explorer with a supplied leading action
- **THEN** its collapse / expand control MUST retain the existing behavior
- **AND** the main Editor navigation controls MUST NOT replace that detached action

### Requirement: Main File Editor MUST Expose Back And Forward Controls And Shortcuts

Main File Editor MUST replace the former header-level “Back to chat” action with adjacent Back and Forward semantic navigation controls and MUST expose platform-correct fixed shortcuts.

#### Scenario: Header controls reflect available history directions

- **WHEN** a Back or Forward destination exists
- **THEN** the corresponding control MUST be enabled and invoke that destination
- **AND** a direction without a destination MUST be disabled

#### Scenario: macOS shortcuts traverse semantic history

- **WHEN** Main File Editor is active and the user presses `Cmd+Option+Left` or `Cmd+Option+Right` on macOS
- **THEN** File Editor MUST invoke Back or Forward respectively when that direction is available

#### Scenario: Windows and Linux shortcuts traverse semantic history

- **WHEN** Main File Editor is active and the user presses `Ctrl+Alt+Left` or `Ctrl+Alt+Right` on Windows or Linux
- **THEN** File Editor MUST invoke Back or Forward respectively when that direction is available

#### Scenario: Disabled shortcut direction is a no-op

- **WHEN** the user invokes a navigation shortcut with no destination in that direction
- **THEN** File Editor MUST leave the active file and cursor unchanged
