## ADDED Requirements

### Requirement: 文件修改场景 MUST 默认折叠且仅显示摘要行

对话幕布中的文件修改场景（连续 edit 工具组成的 `editGroup`，以及 `fileChange` 工具的文件列表）SHALL 默认以折叠态渲染。折叠态 MUST 仅显示图标与含文件数量的场景文案（例如「文件修改（N 个）」/ `File changes (N)`），MUST NOT 展示文件路径列表。

#### Scenario: 多文件 edit 场景首帧折叠

- **WHEN** 幕布渲染包含 2 个及以上连续 edit 工具的 `editGroup`
- **THEN** 首帧 MUST 不展示各文件 path 行
- **AND** 场景标题 MUST 包含文件数量 N

#### Scenario: 单文件 edit 也走场景折叠

- **WHEN** 幕布中仅有 1 个独立 edit 工具
- **THEN** 系统 MUST 仍以可折叠场景壳渲染
- **AND** 默认折叠，不直接铺开该文件 row 的全部详情区作为场景主体

#### Scenario: fileChange 列表默认折叠

- **WHEN** `fileChange` 工具携带 1 个及以上 changed files
- **THEN** 文件列表 MUST 默认折叠在场景摘要行之后
- **AND** 展开前 MUST NOT 显示各文件 path 行

### Requirement: 场景折叠切换 MUST 可访问且场景间独立

每个文件修改场景 MUST 支持指针点击与键盘 Enter/Space 切换展开/折叠。切换控件 MUST 暴露 `aria-expanded`。多个场景的展开状态 MUST 互相独立。

#### Scenario: 点击标题切换

- **WHEN** 用户点击折叠场景的标题行
- **THEN** 场景 MUST 展开并显示完整文件列表
- **AND** 再次点击 MUST 恢复折叠

#### Scenario: 键盘切换

- **WHEN** 焦点在场景标题控件上且用户按下 Enter 或 Space
- **THEN** 场景展开状态 MUST 与点击行为一致切换

#### Scenario: 多场景独立

- **WHEN** 同一幕布存在两个文件修改场景且用户只展开其中一个
- **THEN** 另一个场景 MUST 保持其原有折叠/展开状态

### Requirement: 展开态 MUST 保留完整文件编辑项

场景展开后 MUST 渲染该场景下全部可解析文件项，并保留既有 path、status、additions/deletions 与行级 diff 预览能力；MUST NOT 因折叠容器丢失文件项。

#### Scenario: 展开后列表完整

- **WHEN** 用户展开含 N 个有效文件路径的场景
- **THEN** UI MUST 显示全部 N 个文件项
- **AND** 各文件 row 的 diff 展开/打开能力 MUST 与折叠容器引入前一致

#### Scenario: streaming 增文件不强制收起

- **WHEN** 场景已展开且 streaming 过程中文件数量增加
- **THEN** 场景 MUST 保持展开
- **AND** 新文件项 MUST 出现在列表中

### Requirement: 空场景 MUST 安全降级

当场景内没有任何可解析文件路径时，系统 MUST NOT 渲染空的折叠标题壳。

#### Scenario: 全部缺 path

- **WHEN** edit 工具项均无法解析出 file path
- **THEN** 场景组件 MUST 不渲染可见折叠标题

### Requirement: 连续 edit 与 fileChange MUST 合并为同一文件修改场景

幕布 timeline 分组 MUST 将连续的 `edit`/`write` 类工具与 `fileChange` 工具归入同一场景桶，合并为一个 `editGroup` 折叠块。被 explore / 助手正文 / 其他非文件修改 tool 打断时，MUST 开启新场景。同一场景内 fileChange 的多 path MUST 展开为 per-file row；重复 path MUST 去重后计入 N。

#### Scenario: 连续单文件 fileChange 合并

- **WHEN** 幕布出现连续多个各含 1 个 path 的 `fileChange` tool，中间无 explore 或正文
- **THEN** UI MUST 只渲染一个「文件修改（N 个）」场景摘要
- **AND** 展开后 MUST 列出全部唯一 path

#### Scenario: edit 与 fileChange 混排合并

- **WHEN** 连续出现 edit 工具与 fileChange 工具
- **THEN** 它们 MUST 合并为同一场景，而不是各自一条「文件修改（1 个）」

#### Scenario: explore 打断场景

- **WHEN** 两个 fileChange 之间插入 explore 项
- **THEN** 系统 MUST 拆成两个独立文件修改场景
