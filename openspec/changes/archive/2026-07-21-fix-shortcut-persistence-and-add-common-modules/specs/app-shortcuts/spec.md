## ADDED Requirements

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
