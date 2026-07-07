## ADDED Requirements

### Requirement: 文件树多选 SHALL expose compare action without breaking existing selection semantics

系统 SHALL 在文件树多选文件后提供文件对比入口，并保持现有多选、拖拽、双击打开和多 Tab 打开语义不变。

#### Scenario: context menu preserves selected set for compare
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户在已选集合中的任一文件上打开右键菜单
- **THEN** 系统 SHALL 保留当前 selected set
- **AND** 文件对比动作 SHALL 使用该 selected set 中按可见树顺序排列的文件路径

#### Scenario: right-click outside selection resets compare target
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户在未选中的另一个文件上打开右键菜单
- **THEN** 系统 SHALL 按现有语义切换为单选
- **AND** 文件对比动作 SHALL 不得误用旧 selected set

#### Scenario: compare action does not open normal editor tabs
- **GIVEN** 用户从文件树右键菜单选择文件对比
- **WHEN** compare surface opens
- **THEN** 系统 SHALL NOT add the selected files to normal editor tab list unless the user separately opens them
- **AND** existing editor tabs SHALL remain unchanged

#### Scenario: multi-file drag remains unchanged
- **GIVEN** 用户已在文件树中选中多个文件
- **WHEN** 用户从选中集合发起拖拽
- **THEN** 系统 SHALL continue carrying the selected paths as a drag batch
- **AND** 新增文件对比动作 SHALL NOT alter drag payload semantics
