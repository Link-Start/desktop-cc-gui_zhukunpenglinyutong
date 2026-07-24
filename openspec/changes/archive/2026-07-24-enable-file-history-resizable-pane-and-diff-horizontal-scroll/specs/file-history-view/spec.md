## ADDED Requirements

### Requirement: File History Workbench 区域可拖拽 & 右侧 Diff 支持横向滚动

File History 下面面板 MUST 由 commit rail / previous version column / source version column 三个区域构成，区域宽度 MUST 可由用户拖拽调整；右侧 compare diff 区域 MUST 支持横向滚动以阅读超长行。

The File History lower panel layout was previously a fixed two-column grid with
a non-resizable commit rail and a 1:1 fixed compare split, leaving no way to
give either side more space; long lines were clipped because the compare
columns container used `overflow: hidden`. The contract MUST require the workbench
to expose two draggable separators and let the diff area scroll horizontally.

#### Scenario: 拖拽 commit↔diff 纵向手柄调整 commit rail 宽度

- **WHEN** 用户在 commit rail 与 diff 之间的高 8px 拖拽手柄上 mousedown 并水平 mousemove
- **THEN** commit rail 宽度 MUST 在 [200px, 60% of container] 区间内连续变化
- **AND** diff 区域 MUST 同步收放，不出现空白或重叠
- **AND** mouseup 后释放监听、cursor 复位

#### Scenario: 拖拽 previous↔source 内部手柄调整对比栏比例

- **WHEN** 用户在 previous/source 之间的高 8px 拖拽手柄上 mousedown 并水平 mousemove
- **THEN** previous column 占比 MUST clamp 到 [0.2, 0.8] 区间
- **AND** 两栏 MUST 保持 `min-width: 0` 与同步 compare markers

#### Scenario: 双击手柄复位到默认

- **WHEN** 用户在任何 splitter 上双击
- **THEN** 该区域 MUST 回到默认宽度（commit rail 默认 ~26% / 300px、previous 50%）

#### Scenario: 长 diff 行可横向滚动

- **WHEN** 任意一行内容宽度 > 当前 compare column 的可视宽度
- **THEN** CodeMirror cm-scroller MUST 出现横向滚动条
- **AND** compare columns container MUST 不再以 `overflow: hidden` 截断超宽内容
- **AND** File History workspace 整体宽度 MUST NOT 被撑宽

#### Scenario: 720px narrow breakpoint 保留 stack

- **WHEN** inline-size container 宽度 <= 720px
- **THEN** splitter MUST 隐藏、stack 为 commit rail 上 / diff 下的两行布局
- **AND** 现有 container query 行为 MUST 不变
