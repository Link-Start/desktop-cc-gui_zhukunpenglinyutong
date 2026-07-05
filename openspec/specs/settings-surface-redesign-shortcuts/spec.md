# settings-surface-redesign-shortcuts Specification

## Purpose
TBD - created by archiving change retro-settings-surface-redesign-and-shortcuts. Update Purpose after archive.
## Requirements
### Requirement: Shortcut recording MUST expose clear editing state

Settings shortcut editing SHALL 清晰表达 recording、saved、cleared、conflict/error states。

#### Scenario: 录入快捷键

- **WHEN** 录入快捷键
- **THEN** 当用户开始录入快捷键时，UI 必须显示等待键入状态；保存或清除该快捷键不得影响无关快捷键设置。

### Requirement: Settings visual redesign MUST preserve persisted semantics

Settings panel visual redesign SHALL 不改变现有 persisted settings 的含义，除非 spec 明确声明。

#### Scenario: 设置区重排或换色

- **WHEN** 设置区重排或换色
- **THEN** 当 settings section 改变 layout 或 colors 时，已有 setting values 必须保持相同 serialized meaning，vendor/provider styling 不得暗示不同连接状态。

### Requirement: Claude thinking visibility current behavior MUST be explicit

系统 SHALL 明确记录当前 UI 强制显示 Claude thinking 的实现事实。

#### Scenario: Claude reasoning 可用

- **WHEN** Claude reasoning 可用
- **THEN** 当当前 UI state 强制 Claude thinking visible 时，reasoning content 可以默认展示；未来若恢复用户控制，必须更新此 contract。

