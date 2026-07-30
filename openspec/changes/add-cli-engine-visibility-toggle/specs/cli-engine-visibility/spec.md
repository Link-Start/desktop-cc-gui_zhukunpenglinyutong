## ADDED Requirements

### Requirement: 设置页 CLI 导航 MUST 按用户意愿分组展示

「CLI配置管理」导航 MUST 将 CLI 分为「已启用」「未启用」「暂未开放」三组渲染。`supported: true` 且未被用户停用的 CLI MUST 归入「已启用」；`supported: true` 且已被用户停用的 CLI MUST 归入「未启用」；`supported: false` 的 CLI MUST 全部归入「暂未开放」。

#### Scenario: 默认全启用

- **WHEN** 用户从未操作过 CLI 开关（`disabledCliEngines` 为空）
- **THEN** 全部 supported CLI MUST 出现在「已启用」组
- **AND** 「未启用」组 MUST NOT 渲染

#### Scenario: 停用后落入未启用组

- **WHEN** 用户在某 supported CLI 行的「...」菜单选择「关闭启用」
- **THEN** 该 CLI MUST 从「已启用」组移入「未启用」组
- **AND** 该变更 MUST 持久化到 `AppSettings.disabledCliEngines`
- **AND** 「未启用」组 MUST 自动展开一次，给出可见归宿

#### Scenario: 启停操作收进 hover 菜单

- **WHEN** 用户未与行交互（无 hover / focus / 菜单打开）
- **THEN** supported CLI 行 MUST NOT 常驻展示启停控件
- **AND** hover / focus / 菜单打开时任一条件下「...」按钮 MUST 可见可点

#### Scenario: 未启用与暂未开放组默认折叠

- **WHEN** 用户打开「CLI配置管理」（初次挂载）
- **THEN** 「暂未开放」组 MUST 默认折叠
- **AND** 「未启用」组 MUST 默认折叠（即使挂载时已有停用项）
- **AND** 「已启用」组 MUST 默认展开

#### Scenario: 搜索时平铺

- **WHEN** 用户在搜索框输入过滤词
- **THEN** 导航 MUST 退回跨组平铺过滤
- **AND** MUST NOT 渲染组 header

### Requirement: CLI 开关 MUST 只控制可见性

停用 CLI MUST NOT 删除或改写该 CLI 的供应商配置、本地配置文件或会话数据。

#### Scenario: 停用后配置保留

- **WHEN** 用户停用某已配置供应商的 CLI
- **THEN** 该 CLI 的供应商配置 MUST 原样保留
- **AND** 用户点击「未启用」组中该 CLI 时 MUST 仍能打开其配置页编辑

#### Scenario: 重新启用后配置可用

- **WHEN** 用户重新启用此前停用的 CLI
- **THEN** 该 CLI MUST 回到「已启用」组
- **AND** 其既有配置 MUST 立即可用

### Requirement: composer 引擎选择器 MUST 隐藏已停用引擎

composer 的引擎选择器 MUST NOT 列出已被用户停用的引擎；当前会话正在使用的引擎不受停用影响。

#### Scenario: 停用引擎不出现在下拉

- **WHEN** 用户已停用某引擎对应 CLI
- **AND** 打开 composer 引擎选择器
- **THEN** 下拉列表 MUST NOT 包含该引擎

#### Scenario: 当前选中引擎兜底显示

- **WHEN** 当前会话引擎已被用户停用
- **THEN** 引擎选择器 MUST 仍显示该当前引擎值
- **AND** 该会话 MUST 继续正常工作

#### Scenario: 允许全部停用

- **WHEN** 用户停用全部 supported CLI
- **THEN** 系统 MUST 允许该状态
- **AND** MUST NOT 强制要求至少保留一个启用
