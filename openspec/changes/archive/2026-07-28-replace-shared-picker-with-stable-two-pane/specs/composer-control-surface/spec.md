## MODIFIED Requirements

### Requirement: Provider Model Lists MUST Expand Mutually Exclusively

Composer Provider Profile 与 Model 列表 MUST 使用互斥折叠；同一 selector 中同一时间最多
展开一个 Provider Profile 的 Model 列表。Shared Session 的 CLI、Provider Profile 与
Model picker MUST 在同一
`DropdownMenuContent` focus surface 内完成交互。CLI 列表和当前 CLI 的 Provider/Model
列表 MAY 采用双栏布局，但 Provider accordion MUST NOT 放入 nested
`DropdownMenuSubContent`。CLI 切换、Provider 展开与折叠属于 non-terminal action，
MUST NOT dismiss root menu；同一时刻最多一个 Provider Profile 的 Model list 展开。
Model selection 属于 terminal action，MUST 原子提交 `ExecutionTarget` 并关闭 picker。

#### Scenario: Shared picker uses one focus surface

- **WHEN** 用户打开 Shared Session model picker
- **THEN** CLI 列表与 Provider/Model panel MUST 位于同一 root menu
- **AND** Shared target path MUST NOT 创建 nested submenu content

#### Scenario: CLI activation switches the provider panel without dismissing

- **WHEN** 用户激活另一个 enabled CLI
- **THEN** picker MUST 保持打开
- **AND** Provider panel MUST 展示该 CLI 的 Provider Profiles
- **AND** `ExecutionTarget` MUST NOT 在浏览阶段改变

#### Scenario: Provider accordion remains mutually exclusive and responsive

- **WHEN** 用户连续展开、折叠或切换 Provider A 与 Provider B
- **THEN** picker MUST 保持打开且响应每次操作
- **AND** 同一时刻最多一个 Provider 的 Model list 展开

#### Scenario: Model selection terminates the picker

- **WHEN** 用户选中展开 Provider 下的 Model
- **THEN** system MUST 提交一次对应 `ExecutionTarget`
- **AND** picker MUST 关闭
