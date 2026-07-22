## ADDED Requirements

### Requirement: Expand Selection MUST Be Discoverable From The File Editor Context Menu

可编辑文件的 context menu MUST 提供与 editor-scoped shortcut 等价的“扩大选择范围”操作，并 MUST 使用 shared platform formatter 显示当前配置的 shortcut。

#### Scenario: context menu expands the syntax selection
- **WHEN** 用户在可编辑文件中打开 context menu 并选择“扩大选择范围”
- **THEN** editor MUST 使用现有 CodeMirror `selectParentSyntax` command 扩大选择
- **AND** editor MUST 恢复 focus

#### Scenario: shortcut hint follows platform and settings
- **WHEN** context menu 显示“扩大选择范围”
- **THEN** macOS MUST 显示 macOS shortcut notation
- **AND** Windows/Linux MUST 显示 platform-primary `Ctrl` notation
- **AND** 已清空 shortcut setting 时菜单 MUST 保留操作入口但不显示 shortcut hint

#### Scenario: unavailable editor does not expose a dead action
- **WHEN** 文件处于 preview、loading、truncated 或 editor view 尚未就绪状态
- **THEN** context menu MUST NOT 暴露不可执行的“扩大选择范围”入口
