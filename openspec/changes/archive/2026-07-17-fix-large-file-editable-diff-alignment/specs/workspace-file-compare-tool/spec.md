## ADDED Requirements

### Requirement: Large File Compare SHALL Preserve Sequence Alignment

系统 SHALL 在 workspace file compare 的大文件输入超过 full-matrix 预算时继续使用 line-sequence alignment，使局部 edits 不会扩大为整段 false-positive differences。

#### Scenario: local insertion does not shift the unchanged suffix

- **GIVEN** 两个 large compare columns 仅在中间插入少量行
- **WHEN** diff calculation 超过 full-matrix cell budget
- **THEN** inserted lines SHALL 被标记为 changed
- **AND** insertion 之后内容相同的行 SHALL 保持对齐且不得标记为 changed

#### Scenario: multiple distant edits retain stable gaps

- **GIVEN** large compare columns 包含多个相距较远的 insertion 与 deletion regions
- **WHEN** compare surface 构建 line markers 与 gap decorations
- **THEN** markers SHALL 只覆盖真实 changed line numbers
- **AND** gap decorations SHALL 在每个 edit region 后重新收敛到 shared unchanged lines

#### Scenario: small compare behavior remains compatible

- **GIVEN** compare inputs 未超过 full-matrix cell budget
- **WHEN** diff calculation runs
- **THEN** existing replacement pairing 与 n-way gaps SHALL 保持原有语义

#### Scenario: edit distance exceeds the bounded jsdiff limit

- **GIVEN** large compare columns 在文件前部新增超过 2048 行
- **AND** insertion 后仍存在 large shared unchanged suffix
- **WHEN** bounded `diffArrays` 主动终止
- **THEN** fallback SHALL 使用单调 shared unique-line anchors 重新收敛
- **AND** unchanged suffix SHALL NOT 因 index fallback 被标记为 changed
- **AND** fallback SHALL 保持 bounded memory，不得进入 full quadratic matrix

### Requirement: Compare Navigation SHALL Count Contiguous Difference Blocks

系统 SHALL 使用 shared aligned rows 将连续 changed rows 聚合为 navigation blocks，同时保留逐行 markers 与 changed line numbers。

#### Scenario: adjacent changed rows form one navigation target

- **GIVEN** 一个 change region 包含多个连续 changed rows
- **WHEN** compare result 构建 navigation data
- **THEN** 这些 rows SHALL 只计为一个 diff block
- **AND** block anchor SHALL 使用第一条 changed row 的 aligned row 与 column line numbers

#### Scenario: unchanged row separates navigation blocks

- **GIVEN** 两组 changed rows 之间至少存在一条 unchanged aligned row
- **WHEN** previous/next navigation 遍历 compare result
- **THEN** 两组 changed rows SHALL 计为两个 diff blocks
- **AND** navigation SHALL 分别定位两个 block 的首行

### Requirement: Compare Alignment Gaps SHALL Be Visually Explicit

系统 SHALL 在 shared compare editor 中区分 alignment gap 与 source 中的真实空行，同时保持 column header 紧凑可扫描。

#### Scenario: role and path share one header row

- **GIVEN** compare column 同时存在 role label 与 file path
- **WHEN** column header 渲染
- **THEN** 两者 SHALL 位于同一行
- **AND** path SHALL 在空间不足时 ellipsis，header actions SHALL 保持可见
- **AND** all column headers SHALL 使用相同 fixed height，不得按各自 action content 独立撑高
- **AND** all editor top edges SHALL 保持 pixel-level horizontal alignment

#### Scenario: visual gap uses diagonal hatch treatment

- **GIVEN** compare alignment 产生一个或多个 missing rows
- **WHEN** gap widget 渲染对应高度
- **THEN** widget SHALL 保留空白感并叠加从左下向右上的 subtle diagonal hatch
- **AND** actual blank source lines SHALL NOT 获得 gap pattern

#### Scenario: gap height follows measured editor line height

- **GIVEN** compare editor 已产生 measured `view.defaultLineHeight`
- **AND** alignment gap 表示 N 个 missing rows
- **WHEN** gap widget 计算 block height
- **THEN** height SHALL 等于 `N × view.defaultLineHeight` pixels
- **AND** multiple gaps SHALL NOT 累积左右 column vertical offset
