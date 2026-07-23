## ADDED Requirements

### Requirement: Quick navigation SHALL toggle in-shell modules on repeated activation

快速导航对 in-shell 模块 MUST 提供回切语义：目标模块当前已打开时，再次激活相同入口 MUST 关闭该模块；未打开时 MUST 执行既有 open action。支持回切的入口：`文件` / `代码变更` / `Git 历史` / `看板` / `意图画布` / `项目地图` / `便签` / `项目记忆` / `设置`。`全局搜索` MUST 保持 open-only（两面板互斥，见下方专属 scenario）；`对话` MUST NOT 回切（默认落点）；`Spec Hub` MUST 保持 open-or-focus；`终端` 维持既有 toggle 行为不变。

#### Scenario: toggle off a right-panel module
- **GIVEN** 右侧面板已以 `文件` / `代码变更` / `便签` / `项目记忆` 模式展开
- **WHEN** 用户通过快速导航再次激活相同入口
- **THEN** 系统 MUST 收起右侧面板
- **AND** `便签` 回切时 MUST 连带将 center mode 复位到 chat

#### Scenario: toggle off a center-mode or app-mode module
- **GIVEN** `意图画布` / `项目地图` 正处于 center mode，或 `看板` / `Git 历史` 正处于对应 app mode
- **WHEN** 用户再次激活相同入口
- **THEN** 系统 MUST 回到 chat 落点（`setCenterMode("chat")` 或 `setAppMode("chat")`）

#### Scenario: toggle off settings
- **WHEN** 设置弹窗已打开且用户再次激活 `设置` 入口
- **THEN** 系统 MUST 调用 `closeSettings` 将其关闭

#### Scenario: global search stays open-only because the two palettes are mutually exclusive
- **GIVEN** 打开 Quick Switcher 时系统 MUST 先关闭 Search Palette（两面板互斥）
- **WHEN** 用户通过快速导航激活 `全局搜索`
- **THEN** 系统 MUST 仅执行 open action（打开 Search Palette），MUST NOT 提供回切语义
- **AND** 因互斥约束，Search Palette 的已打开状态在 Quick Switcher 打开期间运行时不可达，`全局搜索` 导航行 MUST NOT 依赖该状态呈现 is-active 高亮（代码中的判定/回切分支为契约性守护，design.md D1 已说明）

#### Scenario: module state survives quick switcher reopen
- **GIVEN** 用户已通过快速导航打开某模块（Quick Switcher 随之关闭）
- **WHEN** 用户再次打开 Quick Switcher 并点击相同入口
- **THEN** 系统 MUST 依据 app-shell 中的持久模块状态执行回切而非重复打开

### Requirement: Quick navigation SHALL indicate the currently active module

当前已打开的模块对应导航行 MUST 呈现可区分的高亮态（is-active），模块关闭后高亮 MUST 消失。高亮为纯展示，MUST NOT 改变键盘导航行为。

#### Scenario: active module row is highlighted
- **WHEN** 某支持回切的模块处于打开状态且用户打开 Quick Switcher
- **THEN** 对应导航行 MUST 渲染 is-active 视觉态
- **AND** 模块关闭后再次打开 Quick Switcher 时该高亮 MUST 消失

### Requirement: Quick navigation SHALL hint instead of opening to an empty default page

当激活条件不满足时，快速导航 MUST 展示可感知的提示并 MUST NOT 打开模块或落入空默认页。适用入口与条件：`意图画布` / `项目地图` / `便签` / `项目记忆` / `终端` 在无 active workspace 时。

#### Scenario: no workspace shows info toast
- **WHEN** 无 active workspace 且用户激活上述任一入口
- **THEN** 系统 MUST 展示 info 级 toast 提示先选择工作区
- **AND** MUST NOT 执行该模块的 open action
- **AND** Quick Switcher MUST 关闭

#### Scenario: intent canvas uses toast instead of blocking alert
- **WHEN** 无 active workspace 且用户激活 `意图画布`
- **THEN** 系统 MUST 使用 toast 提示，MUST NOT 触发 `window.alert` 阻塞弹窗
