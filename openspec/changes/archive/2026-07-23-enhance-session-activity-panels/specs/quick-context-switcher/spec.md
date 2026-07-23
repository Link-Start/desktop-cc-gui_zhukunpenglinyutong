## MODIFIED Requirements

### Requirement: Quick navigation SHALL reuse canonical module open actions

快速导航 MUST 包含 Spec Hub、意图画布和项目地图，并 MUST 调用各模块已有 canonical open action。渲染在导航栏中的每个条目 MUST 有可达的激活行为；无法接通 canonical action 的条目 MUST 被移除，MUST NOT 以无响应的死项形式保留。

#### Scenario: Open detached Spec Hub
- **WHEN** 用户激活 Spec Hub navigation row
- **THEN** 系统 MUST 调用现有 `handleOpenSpecHub`
- **AND** MUST 创建或聚焦 detached Spec Hub window，而不是切换 legacy in-shell tab

#### Scenario: Open visual workspace tools
- **WHEN** 用户激活意图画布或项目地图 navigation row
- **THEN** 系统 MUST 分别调用 `handleOpenIntentCanvas` 或 `handleOpenProjectMap`
- **AND** Quick Switcher MUST 关闭

#### Scenario: no dead navigation rows
- **WHEN** 用户激活任意渲染在快速导航栏中的条目
- **THEN** 系统 MUST 执行与对应模块入口一致的 canonical action
- **AND** MUST NOT 出现点击无任何响应的导航项
