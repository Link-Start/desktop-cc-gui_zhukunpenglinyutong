## MODIFIED Requirements

### Requirement: Activity Panel Primary File Click MUST Open The File And Maximize The Editor Surface

当 workspace session activity 面板 **可用** 时，文件条目主点击 MUST 打开目标文件并在支持时最大化 editor surface。  
当 activity 处于 **runtime disabled** 时，本 requirement 的 UI 路径 MUST 不可达，系统 MUST NOT 因此崩溃。

#### Scenario: primary click is unreachable while activity disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 用户无法打开 activity 面板
- **THEN** 系统 MUST NOT 暴露 activity 文件主点击 affordance
- **AND** 既有 Files / Search / 消息区文件打开路径 MUST 保持可用

### Requirement: Activity Panel Diff Icon Opens Diff Preview

当 activity 面板可用时，文件条目 MUST 提供独立 diff icon。  
当 activity disabled 时，该 affordance MUST 不可达。

#### Scenario: diff icon is unreachable while activity disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 用户浏览右侧面板
- **THEN** 系统 MUST NOT 要求渲染 activity 内 diff icon
- **AND** Git panel 的 diff 打开路径 MUST 保持可用
