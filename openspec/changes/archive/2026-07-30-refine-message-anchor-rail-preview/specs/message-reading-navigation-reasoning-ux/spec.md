## ADDED Requirements

### Requirement: Message anchor rail MUST expose bounded single-anchor previews

消息阅读界面的 user-message anchor rail MUST 位于幕布左侧；每个可见 dash MUST 对应一个 bounded user-message anchor，并从顶部按有界间距紧凑排列。active anchor MUST 仅使用更深的视觉强调且保持默认长度；hover/focus 的 dash MUST 作为局部峰值横向拉长，邻近 dash MUST 按距离逐级收敛。系统 MUST NOT 因 hover rail 而展开包含全部 user turns 的目录面板。

#### Scenario: hovering one anchor shows only its preview

- **WHEN** 用户 hover 任意可见 message anchor dash
- **THEN** 系统 MUST 只展示该 anchor 的单个 preview card
- **AND** preview MUST 展示该 user message 的 title 与可用的 bounded plain-text description
- **AND** DOM 中 MUST NOT 同时渲染其他 anchor 的目录 row 或 preview card

#### Scenario: keyboard focus exposes the same preview and jump behavior

- **WHEN** keyboard focus 进入某个 message anchor dash
- **THEN** 系统 MUST 展示与 pointer hover 相同的单锚点 preview
- **AND** `Enter` 或 `Space` MUST 触发该 anchor 的既有 jump behavior

#### Scenario: preview remains inside the rail reading boundary

- **WHEN** 首部、尾部或中间位置的 anchor 展示 preview
- **THEN** preview placement MUST 根据 anchor 位置选择向下、居中或向上展开
- **AND** preview MUST 使用 bounded width 与 bounded text，避免覆盖为完整目录面板或越出可用 viewport 边界

#### Scenario: long conversation keeps anchor rendering bounded

- **WHEN** user-message anchor 数量超过 rail 的视觉预算
- **THEN** 系统 MUST 使用有界的代表性 dash 集合
- **AND** 当前 active anchor MUST 保留在可见 dash 集合中
- **AND** 每个 dash MUST 保持完整 user-turn 序列的先后顺序
- **AND** dash 间距 MUST 保持 bounded，不得因 anchor 数量较少而拉满 rail

#### Scenario: targeted anchor creates a bounded local protrusion

- **WHEN** pointer hover 或 keyboard focus 进入某个 anchor dash
- **THEN** 该 dash MUST 成为最长峰值
- **AND** 前后最多三根可见 dash MUST 按 index distance 对称、逐级缩短
- **AND** 局部范围之外的 dash MUST 保持普通长度
- **AND** active 但未 hover/focus 的 dash MUST 保持普通 dash 长度，仅使用更深颜色

#### Scenario: rail uses the approved compact visual scale

- **WHEN** rail 渲染 bounded anchor 集合
- **THEN** 普通 dash、hover/focus dash 与 row pitch MUST 使用紧凑尺寸，避免出现双倍放大的视觉比例
- **AND** preview card MUST 紧邻目标 dash，并使用 bounded compact width、padding、radius 与 shadow
- **AND** 视觉校准 MUST NOT 改变 anchor sampling、jump behavior 或 preview boundary placement
