# app-shortcuts Specification

## Purpose

Defines the app-shortcuts behavior contract, covering App Shortcuts MUST Use A Shared Configurable Contract.
## Requirements
### Requirement: App Shortcuts MUST Use A Shared Configurable Contract

Application-level keyboard shortcuts MUST be represented by stable action metadata and persisted settings instead of feature-local hardcoded key checks.

#### Scenario: new app shortcut has complete metadata
- **WHEN** a new application-level shortcut action is added
- **THEN** it MUST define a stable action id
- **AND** it MUST define a persisted setting key
- **AND** it MUST define an i18n label key
- **AND** it MUST define a scope such as `global`, `surface`, `editor`, or `native-menu`
- **AND** it MUST define a default shortcut or an explicit `null` default

#### Scenario: settings renders every configurable app shortcut
- **WHEN** a shortcut action is configurable
- **THEN** Settings -> Basic -> Shortcuts MUST render it in an appropriate group
- **AND** the user MUST be able to edit or clear the shortcut from that surface
- **AND** the legacy Settings -> Shortcuts section input MUST be migrated away and removed after Settings -> Basic -> Shortcuts is available

#### Scenario: shortcut display is platform-aware
- **WHEN** Settings displays a shortcut value
- **THEN** the display MUST use the shared platform formatter
- **AND** it MUST NOT hardcode macOS-only labels for non-macOS platforms

### Requirement: App Shortcuts MUST Reuse Shared Parsing And Matching

Application-level shortcut handlers MUST use the shared shortcut parser and platform-aware matcher.

#### Scenario: global handler matches configured shortcut
- **WHEN** a user presses a configured shortcut
- **THEN** the handler MUST evaluate the event through the shared shortcut matcher
- **AND** it MUST respect platform primary modifier mapping

#### Scenario: editable targets are protected
- **WHEN** focus is inside an input, textarea, select, contenteditable surface, or editor textbox
- **THEN** global app shortcuts MUST NOT steal the event unless the action is explicitly editor-scoped

#### Scenario: invalid shortcut values are ignored safely
- **WHEN** a persisted shortcut value cannot be parsed
- **THEN** the handler MUST ignore that shortcut
- **AND** the app MUST continue running without throwing during render or event handling

### Requirement: Open Session Navigation Shortcuts MUST Follow Visible Session Order

The app MUST provide configurable shortcuts for switching to the previous and next open session.

#### Scenario: next open session shortcut advances through open sessions
- **WHEN** multiple open sessions are visible in the session tab order
- **AND** the user presses the configured next open session shortcut
- **THEN** the app MUST activate the next session in that visible order
- **AND** it MUST switch workspace if the target session belongs to another workspace

#### Scenario: previous open session shortcut moves backward through open sessions
- **WHEN** multiple open sessions are visible in the session tab order
- **AND** the user presses the configured previous open session shortcut
- **THEN** the app MUST activate the previous session in that visible order
- **AND** it MUST switch workspace if the target session belongs to another workspace

#### Scenario: session navigation no-ops when unavailable
- **WHEN** there is no active open session
- **OR** there is only one open session
- **THEN** previous/next open session shortcuts MUST no-op
- **AND** they MUST NOT show an error toast

### Requirement: Conversation Sidebar Shortcuts MUST Toggle Layout Visibility

The app MUST provide configurable shortcuts for toggling left and right conversation/sidebar surfaces.

#### Scenario: left sidebar shortcut toggles left conversation surface
- **WHEN** the user presses the configured left sidebar shortcut
- **THEN** the app MUST toggle the left conversation/sidebar surface visibility using existing layout state
- **AND** it MUST NOT create, archive, or switch sessions as a side effect

#### Scenario: right sidebar shortcut toggles right conversation surface
- **WHEN** the user presses the configured right sidebar shortcut
- **THEN** the app MUST toggle the right conversation/sidebar surface visibility using existing layout state
- **AND** it MUST NOT mutate the currently selected file, Git diff, memory tab, or runtime data

#### Scenario: compact layout remains stable
- **WHEN** a sidebar shortcut is pressed in compact or phone layout
- **THEN** the app MUST follow existing responsive layout behavior or no-op safely
- **AND** it MUST NOT leave overlapping incoherent panels visible

### Requirement: Terminal And Runtime Console Shortcuts MUST Remain Separate

Terminal toggle and runtime console toggle MUST be independent configurable actions.

#### Scenario: terminal shortcut toggles terminal panel
- **WHEN** the user presses the configured terminal shortcut
- **THEN** the app MUST toggle the terminal panel
- **AND** it MUST NOT open the runtime console solely because of that shortcut

#### Scenario: runtime console shortcut toggles runtime console
- **WHEN** the user presses the configured runtime console shortcut
- **THEN** the app MUST toggle the runtime console surface
- **AND** it MUST NOT start, stop, restart, or interrupt a runtime solely because of that shortcut

#### Scenario: disabled runtime console shortcut no-ops
- **WHEN** the runtime console shortcut setting is `null`
- **THEN** pressing the suggested default key combination MUST NOT toggle the runtime console

### Requirement: Files Surface Shortcut MUST Not Steal Editor Scoped Shortcuts

The app MUST provide a configurable files surface shortcut while preserving editor-specific save and find shortcuts.

#### Scenario: files shortcut opens or focuses files surface
- **WHEN** the user presses the configured files surface shortcut outside editable/editor targets
- **THEN** the app MUST open, focus, or toggle the files surface according to the implemented files action
- **AND** the action MUST be documented in Settings -> Shortcuts

#### Scenario: editor save remains editor scoped
- **WHEN** focus is inside the file editor
- **AND** the user presses the configured save file shortcut
- **THEN** the editor save action MUST take precedence over global files shortcuts

#### Scenario: editor find remains editor scoped
- **WHEN** focus is inside the file editor
- **AND** the user presses the configured find in file shortcut
- **THEN** the editor find action MUST take precedence over global files shortcuts

### Requirement: Shortcut Defaults MUST Be Conflict-Audited

Shortcut defaults MUST be audited before implementation and must avoid known high-risk conflicts.

#### Scenario: default shortcut table is reviewed
- **WHEN** implementation assigns or changes a default shortcut
- **THEN** the implementation notes or tests MUST cover collisions with existing app shortcuts
- **AND** they MUST cover editor scoped shortcuts

#### Scenario: high-risk default can be null
- **WHEN** no low-conflict default exists for an action
- **THEN** the action MAY default to `null`
- **AND** Settings MUST still allow the user to configure it manually

#### Scenario: existing custom shortcuts survive upgrade
- **WHEN** a user already has custom shortcut settings
- **THEN** adding new shortcut fields MUST NOT reset existing custom shortcut values

### Requirement: Composer Slash Command State MUST Be One-Shot

#### Scenario: custom slash command residue is cleared before subsequent sends

- **WHEN** a custom slash command has been selected or inserted for one composer send
- **THEN** the slash command residue SHALL be cleared before the next unrelated send
- **AND** a later plain message SHALL NOT inherit the previous command selection or command text

#### Scenario: early cleanup remains safe on failed send attempts

- **WHEN** command residue cleanup runs before or during send preparation
- **THEN** the cleanup SHALL NOT delete the user's current plain text input
- **AND** retry behavior SHALL not reapply an already-consumed custom command unless the user explicitly selects it again

### Requirement: Icon Button Tooltips MUST Not Leave Residual Hover UI

#### Scenario: tooltip closes after icon button activation

- **WHEN** a user activates an icon-only button with a tooltip
- **THEN** the tooltip SHALL close or become non-visible after activation/focus transition
- **AND** residual tooltip content SHALL NOT remain floating over the app after the action has completed

### Requirement: Close Current Session Shortcut MUST Be Configurable

The app SHALL expose a configurable shortcut action for closing the currently open session tab.

#### Scenario: close current session shortcut appears in settings
- **WHEN** the user opens Settings -> Shortcuts
- **THEN** the close-current-session action SHALL be visible in the shortcut list
- **AND** the user SHALL be able to edit or clear the shortcut

#### Scenario: close current session shortcut has a default
- **WHEN** app settings are initialized without an explicit close-current-session shortcut
- **THEN** the default shortcut SHALL be `cmd+w`
- **AND** existing unrelated shortcut customizations SHALL remain unchanged

#### Scenario: configured shortcut is matched through shared shortcut helpers
- **WHEN** the user presses the configured close-current-session shortcut
- **THEN** the event SHALL be evaluated through the shared shortcut parser and platform-aware matcher

### Requirement: Shortcut Settings MUST Survive Desktop Persistence Round-Trips

Every configurable shortcut exposed by the frontend `AppSettings` contract MUST be preserved by the Rust settings deserialize/save/serialize round-trip, including explicit `null` values.

#### Scenario: custom shortcut survives save echo

- **WHEN** 用户为任一 configurable shortcut 录入非默认组合并保存
- **THEN** Tauri settings response MUST return the same shortcut value
- **AND** Settings UI MUST NOT restore the previous/default value after parent state reconciliation

#### Scenario: cleared shortcut remains disabled

- **WHEN** 用户将 configurable shortcut 清空为 `null`
- **THEN** Rust persistence MUST retain explicit `null`
- **AND** later settings reload MUST NOT silently restore a default for that persisted field

### Requirement: Settings MUST Provide A Featured Common Modules Shortcut Group

Settings → Basic → Shortcuts MUST render a topmost common-modules group backed by the same stable action metadata used by the semantic shortcut groups.

#### Scenario: common modules group is complete and first

- **WHEN** 用户打开快捷键设置
- **THEN** the first shortcut group MUST contain left conversation sidebar, right conversation sidebar, Git Graph, Files, Git, Notes, Intent Canvas, Radar, Project Map, Browser Dock, File Compare, and Terminal

#### Scenario: duplicated projection shares one setting

- **WHEN** an existing action is shown in both the common group and its semantic group
- **THEN** both controls MUST read and update the same persisted setting key
- **AND** the application MUST NOT create independent shortcut values for the two rows

### Requirement: Common Module View Actions MUST Be Configurable And Scoped

Git Graph, Notes, Intent Canvas, Radar, Project Map, Browser Dock, and File Compare MUST expose configurable shortcut actions that reuse existing view transitions.

#### Scenario: configured module shortcut opens the existing view

- **WHEN** 用户在非 editable target 按下已配置的 module shortcut
- **THEN** the app MUST invoke the corresponding existing open/toggle handler
- **AND** the shortcut MUST NOT create a parallel module state or duplicate business side effect

#### Scenario: new module shortcuts are unbound by default

- **WHEN** settings are initialized without persisted values for the new module actions
- **THEN** each new module shortcut MUST default to `null`
- **AND** pressing an arbitrary suggested combination MUST NOT open the module

#### Scenario: editable targets remain protected

- **WHEN** focus is inside input, textarea, select, contenteditable, or editor textbox
- **THEN** common module global shortcuts MUST NOT consume the keyboard event
