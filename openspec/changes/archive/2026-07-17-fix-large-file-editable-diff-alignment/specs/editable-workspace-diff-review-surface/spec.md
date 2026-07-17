## ADDED Requirements

### Requirement: Editable Review Difference Navigation MUST Use Diff Blocks

系统 MUST 在 workspace-backed editable review 中将连续 changed rows 聚合为 diff block，并使用每个 block 的首行作为 navigation anchor；不得因文件规模 fallback 把未修改 suffix 计为差异。

#### Scenario: small insertion near the start of a large file

- **GIVEN** baseline 与 source 均约 4,000 行
- **AND** source 只在文件前部新增 14 行
- **WHEN** editable Diff modal 完成 alignment
- **THEN** 14 个连续 changed rows MUST 聚合为 1 个 diff block
- **AND** difference counter MUST 显示 `1 / 1`
- **AND** previous/next difference navigation MUST 定位该 block 首行且不得遍历 block 内其余行
- **AND** unchanged suffix MUST 保持左右 line alignment

#### Scenario: large file contains distant edit hunks

- **GIVEN** large baseline 与 source 在相距较远的位置分别存在 insertion 或 deletion
- **WHEN** editable review 计算 changed rows 与 visual gaps
- **THEN** 每个由 unchanged aligned row 分隔的真实 change region MUST 形成独立 diff block
- **AND** previous/next MUST 依次定位各 block 首行
- **AND** hunk 之间及最后一个 hunk 之后的相同行 MUST NOT 被标记为 changed

#### Scenario: large diff exceeds bounded edit distance

- **GIVEN** large baseline 与 source 的 edit distance 超过同步计算上限
- **WHEN** scalable alignment 主动终止
- **THEN** review MUST 保持稳定可渲染且不得抛出异常
- **AND** source editor 与既有 save contract MUST 保持可用

#### Scenario: Windows CRLF source is edited and saved

- **GIVEN** workspace-backed editable file 使用统一 CRLF line endings
- **AND** CodeMirror `onChange` 返回 LF-normalized content
- **WHEN** 用户保存 Diff editor 中的局部修改
- **THEN** disk write payload MUST 恢复原 CRLF line endings
- **AND** editor state 与 dirty comparison MUST NOT 因磁盘格式转换产生 false dirty
- **AND** external disk snapshot MUST 记录实际写盘格式
- **AND** LF 或 mixed line-ending 文件 MUST NOT 被强制转换为 CRLF

#### Scenario: popup navigation shares the modal header

- **GIVEN** editable compare 在 popup modal 中渲染且存在 external `headerControlsTarget`
- **WHEN** difference navigation 与 Diff view controls 渲染
- **THEN** navigation counter 与 previous/next buttons MUST 位于 modal header 同一行
- **AND** navigation MUST 排在 split/unified/content mode controls 之前
- **AND** compare body MUST NOT 保留独立 navigation header row

#### Scenario: compare columns use compact single-line headers

- **GIVEN** editable compare 渲染 previous/source columns
- **WHEN** column header 展示 role label、file path 与 optional actions
- **THEN** role label 与 file path MUST 位于同一行
- **AND** long file path MUST ellipsis 而不得挤压 actions 或增加第二行 header
- **AND** previous/source headers MUST 使用相同 fixed box height
- **AND** optional Save、dirty 或 error controls MUST NOT 改变任一 editor 的起始 Y 坐标

#### Scenario: missing aligned rows remain visually distinct

- **GIVEN** 一侧 column 因 insertion 或 deletion 产生 alignment gap
- **WHEN** CodeMirror gap widget 填充缺失行高度
- **THEN** gap MUST 使用低对比度 diagonal hatch 区分真实空行
- **AND** hatch MUST 从左下向右上重复，并且 MUST NOT 改变 gap height、editor content 或真实空行样式

#### Scenario: multiple missing rows preserve pixel alignment

- **GIVEN** one compare column 包含一个或多个 alignment gaps
- **AND** CodeMirror 已测量 source lines 的 runtime `defaultLineHeight`
- **WHEN** gap widget 将 missing row count 转换为 pixel height
- **THEN** 每个 virtual row MUST 使用 `view.defaultLineHeight` 的 runtime pixel value
- **AND** 每个 gap 后的 shared unchanged row MUST 与另一列保持 pixel-level horizontal alignment

#### Scenario: truncated preview patch recovers the editable compare

- **GIVEN** workspace-backed editable text file 的 Git list entry 只包含 performance-truncated preview patch
- **AND** preview patch 无法通过当前 saved source 重建 previous version
- **WHEN** popup editable review 解析 baseline
- **THEN** `WorkspaceEditableDiffCompare` MUST 使用 workspace-relative `filePath` 调用 `getGitFileFullDiff`
- **AND** full diff request 完成前 MUST 保持 editable compare shell，不得抢先渲染 legacy patch body
- **AND** full patch 可重建时 MUST 继续渲染 editable split compare，而不得永久停留在 legacy patch viewer
- **AND** full patch 请求失败或仍不可重建时 MUST 保持 editable compare，并在 previous column 显示 baseline unavailable
- **AND** source column 与既有 edit/save contract MUST 保持可用
- **AND** file、workspace 或 modal lifecycle 已变化时 MUST 忽略旧请求结果

#### Scenario: Git file-list entry selects the editable renderer

- **GIVEN** Git changed-file list 中存在 workspace-backed editable text file
- **AND** modal 处于 split + all-content mode
- **WHEN** 用户从该 file row 打开 popup preview
- **THEN** 入口 MUST 经真实 `WorkspaceEditableDiffReviewSurface` 渲染 `WorkspaceEditableDiffCompare`
- **AND** legacy `GitDiffViewer` MUST 仅渲染 toolbar controls，不得渲染旧 patch body
