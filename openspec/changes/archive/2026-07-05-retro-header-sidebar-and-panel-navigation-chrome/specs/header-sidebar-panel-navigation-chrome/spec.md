# Spec Delta: header-sidebar-panel-navigation-chrome

## ADDED Requirements

### Requirement: Global navigation chrome MUST avoid transient live-state layout jumps

Header、Sidebar、Panel tab chrome SHALL 避免仅因 transient live runtime state 发生可见性跳变。

#### Scenario: panel 有 live updates

- **WHEN** panel 有 live updates
- **THEN** 当 panel 有 live activity 但未 active 且未 pinned 时，panel tab strip 不得仅因 live state 强制外显；用户显式 activation/pinning 仍必须生效。

### Requirement: Header toolbar MUST preserve user-pinned app actions

Header toolbar SHALL 支持 user-pinned open-app actions，并保留 overflow handling。

#### Scenario: pin open-app action

- **WHEN** pin open-app action
- **THEN** 当用户 pin 一个 supported open-app action 时，该 action 在空间允许时必须显示在 toolbar，空间不足时仍应通过 overflow 可达。

### Requirement: Sidebar metadata entries MUST be non-disruptive

Sidebar version 和 disabled plugin entries SHALL 提供 metadata 或 coming-soon feedback，不得打断 workspace/session navigation。

#### Scenario: 点击 disabled plugin

- **WHEN** 点击 disabled plugin
- **THEN** 当用户点击 disabled/coming-soon plugin entry 时，系统必须显示 coming-soon feedback，不能导航到不可用 workflow。
