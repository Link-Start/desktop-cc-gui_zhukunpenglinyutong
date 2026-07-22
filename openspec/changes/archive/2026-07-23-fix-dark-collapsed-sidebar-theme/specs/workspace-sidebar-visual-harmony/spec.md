## ADDED Requirements

### Requirement: Desktop Sidebar Collapsed Surfaces MUST Follow Active Appearance

系统 MUST 在 desktop sidebar collapsed 状态下使用 active appearance 的 theme tokens 渲染 app shell、main surface 与被继承的 sidebar surface，不得让 light-only fallback 泄漏到 dark 或 system-dark appearance。

#### Scenario: Explicit dark sidebar collapse keeps dark surfaces

- **WHEN** 用户在 explicit dark appearance 下折叠 desktop sidebar
- **THEN** app shell 暴露区域与嵌入 Settings sidebar MUST 使用 dark theme surface
- **AND** 两者 MUST NOT 回退到 `#ffffff`

#### Scenario: System dark sidebar collapse keeps dark surfaces

- **WHEN** 用户选择 system appearance 且操作系统为 dark mode 后折叠 desktop sidebar
- **THEN** desktop shell 与 sidebar descendants MUST 解析为 dark theme surface
- **AND** system-light 的白色 override MUST NOT 生效

#### Scenario: Light sidebar collapse preserves current contrast

- **WHEN** 用户在 explicit light 或 system-light appearance 下折叠 desktop sidebar
- **THEN** shell 与 main surface MUST 保持现有白色 collapsed contrast
- **AND** sidebar layout、collapse control 与 titlebar placement MUST 保持不变
