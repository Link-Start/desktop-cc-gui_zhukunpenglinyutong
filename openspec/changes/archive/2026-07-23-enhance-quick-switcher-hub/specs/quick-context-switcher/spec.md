## ADDED Requirements

### Requirement: Quick navigation SHALL include discovery entries

快速导航 MUST 在既有模块入口之外提供 `全局搜索`、`便签`、`项目记忆` 入口。`全局搜索` MUST 为导航栏第一项；每个入口 MUST 调用对应 canonical action，激活后 Quick Switcher MUST 按既有语义关闭。

#### Scenario: Open global search from quick navigation
- **WHEN** 用户激活 `全局搜索` navigation row
- **THEN** 系统 MUST 调用 `handleOpenSearchPalette` 打开全局搜索
- **AND** Quick Switcher MUST 关闭（两面板互斥）

#### Scenario: Open notes and project memory from quick navigation
- **WHEN** 用户分别激活 `便签` / `项目记忆` navigation row
- **THEN** 系统 MUST 调用 `handleOpenNotes` / `handleOpenProjectMemory`
- **AND** Quick Switcher MUST 关闭

### Requirement: Quick Switcher SHALL surface running sessions as a live activity section

当存在进行中 AI 会话时，最近会话栏顶部 MUST 展示「进行中」区：每行 MUST 包含可识别的 live 指示、会话标题、workspace 名与相对开始时间。数据 MUST 复用根链既有 `sessionRadarFeed.runningSessions`，MUST NOT 新增 store 订阅、定时器或轮询。已在「进行中」区展示的会话 MUST NOT 重复出现在下方「最近会话」分组。

#### Scenario: running sessions appear above recent sessions
- **GIVEN** 存在至少一个进行中会话
- **WHEN** Quick Switcher 打开
- **THEN** 最近会话栏顶部 MUST 展示「进行中」区并列出全部进行中会话（上限沿用 radar feed 既有 runningLimit）
- **AND** 这些会话 MUST NOT 重复出现在下方最近会话分组

#### Scenario: jump to a running session across workspaces
- **WHEN** 用户激活某进行中会话行
- **THEN** 系统 MUST 切换到该会话所属 workspace 并选中该会话
- **AND** Quick Switcher MUST 关闭

#### Scenario: no running sessions collapses the section
- **WHEN** 不存在进行中会话
- **THEN** 「进行中」区 MUST NOT 渲染、MUST NOT 占用布局空间

#### Scenario: live section is keyboard accessible
- **WHEN** 用户使用方向键在最近会话栏内移动
- **THEN** 「进行中」区各行 MUST 与最近会话行一样参与行内循环导航
- **AND** Enter MUST 激活当前行、Esc MUST 关闭面板
