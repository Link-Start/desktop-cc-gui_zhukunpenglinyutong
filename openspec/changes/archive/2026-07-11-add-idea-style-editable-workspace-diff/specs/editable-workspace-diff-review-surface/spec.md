## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Editable Review MUST Preserve Typing Responsiveness

editable review MUST 将 source text 视为 urgent user-input state，并限制非必要的隐藏 renderer 与 diff alignment 工作。

#### Scenario: user types in a large editable diff

- **WHEN** 用户持续修改右栏 source text
- **THEN** 编辑器内容 MUST 立即更新
- **AND** changed-line alignment MAY 使用 deferred source snapshot 后台收敛
- **AND** toolbar-only `GitDiffViewer` MUST NOT 请求 full diff 或渲染 virtual diff rows
