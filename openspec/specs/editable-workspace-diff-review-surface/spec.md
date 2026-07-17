# editable-workspace-diff-review-surface Specification

## Purpose

Defines the editable-workspace-diff-review-surface behavior contract, covering Workspace-Backed Diff Review MUST Support In-Place Editing.
## Requirements
### Requirement: Workspace-Backed Diff Review MUST Support In-Place Editing

系统 MUST 为当前 workspace working tree 的可写文本 diff review 提供固定双栏直接编辑能力，使用户可以在同一 review surface 内完成 `review -> edit -> save -> refresh`。

#### Scenario: editable review opens as an IDEA-style compare

- **WHEN** 用户从受支持的 workspace diff review 入口打开一个可写文本文件
- **THEN** 系统 MUST 默认显示固定双栏 compare，不得要求用户先点击“编辑”
- **AND** 左栏 MUST 标识为“上个版本”并保持只读
- **AND** 右栏 MUST 标识为“源代码”并可直接输入
- **AND** 两栏 MUST horizontal side-by-side，不得上下堆叠
- **AND** 原弹窗 Toolbar 与 `双栏差异 / 单栏差异 / 全文查看 / 区域查看` MUST 保持可用

#### Scenario: Git History entry loads shared diff styles independently

- **WHEN** 用户首次从应用菜单 Git 入口打开 `GitHistoryPanel`
- **THEN** `loadGitHistoryStyles()` MUST 同时加载 Git History styles 与 shared diff styles
- **AND** `GitHistoryWorktreePanel` 的 file rows、action buttons 与 diff modal MUST 首次打开即具有完整样式
- **AND** 用户 MUST NOT 需要通过右上角 `GitDiffPanel` 入口触发 shared diff style warm-up

#### Scenario: user switches to an original review mode

- **WHEN** 用户选择 `单栏差异` 或 `区域查看`
- **THEN** 系统 MUST 使用原 `GitDiffViewer` renderer 展示对应模式
- **AND** 用户切回 `双栏差异 + 全文查看` 时 MUST 恢复直接可编辑 compare

#### Scenario: diff context remains visible while editing

- **WHEN** 用户在右栏修改源代码
- **THEN** 左栏 MUST 持续展示该 patch 对应的 baseline 内容
- **AND** 双栏 MUST 保持差异行对齐与可用的同步导航语义
- **AND** 当前文件、关闭语义与 review 会话 MUST 保持连续

### Requirement: Editable Review Eligibility MUST Be Explicit

系统 MUST 只对满足条件的 workspace-backed review target 开放 editable compare，不得把历史或只读 diff 伪装成可写。

#### Scenario: historical or non-workspace diff stays read-only

- **WHEN** 当前 diff 来自 commit history、PR compare、rewind review 或其他非 live workspace review surface
- **THEN** 系统 MUST 保持只读 review
- **AND** MUST NOT 暴露可执行保存的 source editor

#### Scenario: deleted or non-editable file stays read-only

- **WHEN** 当前 review file 为 deleted、binary、image、PDF 或 preview-only document
- **THEN** 系统 MUST 保持只读
- **AND** MUST 提供稳定的 read-only reason 或等效受限语义

#### Scenario: baseline cannot be reconstructed safely

- **WHEN** 当前 patch 无法可靠还原上个版本内容
- **THEN** 系统 MUST 回退到原只读 diff renderer
- **AND** MUST NOT 展示可能错误的 baseline source

### Requirement: Editable Review MUST Reuse Existing Workspace File Save Contract

editable review 的右栏保存链路 MUST 复用现有 workspace file editor contract，而不是创建并行写入系统。

#### Scenario: save uses workspace file write pipeline

- **WHEN** 用户在右栏保存当前源代码
- **THEN** 系统 MUST 复用现有 workspace file save contract
- **AND** MUST 保持 dirty-state、save button、save shortcut 与失败提示语义一致

#### Scenario: unsaved changes remain protected during close or file switch

- **WHEN** 用户存在未保存修改并尝试关闭 review 或切换文件
- **THEN** 系统 MUST 触发与现有 file editor 等价的未保存保护
- **AND** MUST NOT 静默丢弃用户修改
- **AND** MUST 使用应用内 `AlertDialog` 展示“保存并关闭 / 继续编辑 / 放弃修改”
- **AND** “保存并关闭” MUST 等待现有 workspace file save contract 成功后再关闭或执行待切换动作
- **AND** 保存失败时 MUST 保留弹窗、草稿与当前 review session
- **AND** MUST NOT 调用平台原生 `window.confirm`
- **AND** close、overlay dismiss、view mode switch 与 file switch MUST NOT 产生 double prompt

#### Scenario: cached draft reopens in editable compare

- **WHEN** 用户编辑右栏后通过其他 preview surface 切换，并再次打开同一文件的 diff modal
- **THEN** 系统 MUST 使用最后一次已保存的 working source 重建左栏 baseline
- **AND** 右栏 MUST 恢复未保存草稿
- **AND** MUST NOT 因草稿无法匹配原 patch 而错误降级为只读 renderer
- **AND** modal toolbar、editor 与 close actions MUST 在重复打开后继续可交互

#### Scenario: disk refresh completes after the user starts editing

- **WHEN** clean cached content 已显示且后台磁盘刷新尚未完成
- **AND** 用户在磁盘响应返回前修改右栏
- **THEN** 系统 MUST 保留用户的本地草稿与 dirty state
- **AND** 后返回的磁盘内容 MUST NOT 覆盖用户输入

#### Scenario: save overlaps another edit or close decision

- **WHEN** workspace file save 正在进行
- **THEN** 重复保存 MUST 复用同一个 in-flight result，不得发出重复写入
- **AND** 未保存弹窗 MUST 禁用继续编辑、放弃修改与重复保存动作
- **AND** 若保存期间产生了新输入，系统 MUST 保持 dirty state 且不得关闭 review

### Requirement: Editable Review MUST Refresh Live Diff After Save

用户保存后，review surface MUST 使用最新 workspace diff 更新 compare，而不是继续展示进入 review 时的旧 patch snapshot。

#### Scenario: save refreshes the current file diff

- **WHEN** 用户在右栏成功保存当前文件
- **THEN** 系统 MUST 刷新当前文件的 live workspace diff
- **AND** 当前 review surface 的 baseline、changed-line markers 与 `+/-` 统计 MUST 反映最新状态

#### Scenario: resolved diff shows no stale patch

- **WHEN** 用户保存后当前文件已不再存在差异
- **THEN** 系统 MUST 显示“无差异”或等效空态
- **AND** MUST NOT 继续渲染保存前的旧 diff 内容

### Requirement: Editable Review MUST Preserve Typing Responsiveness

editable review MUST 将 source text 视为 urgent user-input state，并限制非必要的隐藏 renderer 与 diff alignment 工作。

#### Scenario: user types in a large editable diff

- **WHEN** 用户持续修改右栏 source text
- **THEN** 编辑器内容 MUST 立即更新
- **AND** changed-line alignment MAY 使用 deferred source snapshot 后台收敛
- **AND** toolbar-only `GitDiffViewer` MUST NOT 请求 full diff 或渲染 virtual diff rows

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

### Requirement: All Git changed-file modal entrypoints use the editable review surface
主 Source Control、Git History worktree 与 commit details 的 changed-file modal preview MUST 使用同一个 modal host，并渲染现有 `WorkspaceEditableDiffReviewSurface`；legacy `GitDiffViewer` modal body MUST NOT 作为这些入口的 fallback。

#### Scenario: Worktree file opens unified preview
- **WHEN** 用户从任一 worktree changed-file list 请求 modal preview
- **THEN** 系统 MUST 打开具有统一 header、block navigation、aligned gaps 与 editable current column 的新 preview surface

#### Scenario: Historical commit file opens unified preview
- **WHEN** 用户从 commit details changed-file tree 请求 modal preview
- **THEN** 系统 MUST 通过 commit diff adapter 打开同一种 preview surface，并保持 historical source read-only contract

#### Scenario: Baseline cannot be reconstructed
- **WHEN** full diff recovery 仍无法重建 previous content
- **THEN** 新 preview surface MUST 保持挂载并报告 unavailable state，MUST NOT 回退 legacy modal renderer

