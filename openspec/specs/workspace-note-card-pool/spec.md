# workspace-note-card-pool Specification

## Purpose

Defines the workspace note-card behavior contract, covering the right-panel entry, central workbench, responsive Master-Detail editing, safe draft lifecycle, Composer reference, archive/delete semantics, and split preferences.

## Requirements
### Requirement: Right Panel MUST Provide A Note Card Entry

系统 MUST 在右侧面板顶区 action zone 提供 note card icon 入口，该区域与文件夹、搜索等现有操作同层；入口触发的工作 surface MUST 位于中央区域。

#### Scenario: note icon appears in the right panel top zone

- **WHEN** 用户处于任意 workspace 会话视图且右侧面板工具栏可见
- **THEN** 系统 MUST 在右侧面板顶区渲染 note card icon
- **AND** 该入口 MUST 提供 tooltip 或 accessibility label

#### Scenario: note icon opens the center workbench

- **WHEN** 用户点击 note card icon
- **THEN** 系统 MUST 在中央区域打开 note card workbench
- **AND** 系统 MUST NOT 在右侧面板正文区重复渲染完整 note card manager

#### Scenario: note icon follows existing right-panel visibility rules

- **WHEN** 当前布局触发既有右侧面板 toolbar 隐藏、收起或 compact 规则
- **THEN** note card icon MUST 跟随同一套 show/hide 行为
- **AND** 系统 MUST NOT 为 note card 入口创建独立的显隐状态模型

### Requirement: Note Card Surface MUST Stay Lightweight

系统 MUST 提供轻量 note card center workbench，并且只包含 `便签池` 与 `便签归档` 两个集合。

#### Scenario: opening note cards keeps the current conversation flow intact

- **WHEN** 用户点击 note card icon
- **THEN** 中央区域 MUST 以左侧 conversation : 右侧 note workbench 约 1 : 2 的默认比例并排展示
- **AND** 默认 MUST 打开 `便签池`
- **AND** 当前 conversation/workspace 上下文 MUST 保持不变
- **AND** Composer MUST 保持在 conversation column 内可用

#### Scenario: user resizes the note workbench split

- **WHEN** 用户左右拖动 conversation 与 note workbench 之间的 vertical separator
- **THEN** 系统 MUST 实时调整两个 column 的宽度
- **AND** conversation、Composer 与 note controls MUST 保持各自最小可用宽度
- **AND** separator MUST 提供 resize cursor、separator role 与 accessibility label

#### Scenario: archive view stays in the same surface family

- **WHEN** 用户在 note card workbench 中切换到 `便签归档`
- **THEN** 系统 MUST 在同一中央 workbench 中展示 archived notes
- **AND** 系统 MUST NOT 要求进入 full-screen modal、目录树或管理后台式多层视图

#### Scenario: narrow center area preserves usable content

- **WHEN** 可用中央区域不足以稳定容纳 1 : 2 横向分栏
- **THEN** 系统 MUST 使用 responsive layout 保持 note controls、conversation 与 Composer 可达
- **AND** 文案、按钮和 editor MUST NOT 发生不连贯重叠

### Requirement: Quick Capture MUST Support Formatted Copy And Images

系统 MUST 在中央 note workbench 中支持快速录入 note card，包含格式化文案能力与图片插入能力。

#### Scenario: user saves a quick note without leaving the current workspace flow

- **WHEN** 用户在 note card workbench 输入标题和正文并保存
- **THEN** 系统 MUST 将该 note 保存到当前项目的 `便签池`
- **AND** 用户 MUST 无需离开当前 workspace 或 thread 才能完成记录

#### Scenario: title can fall back from content

- **WHEN** 用户保存 note 时未填写标题
- **THEN** 系统 MUST 使用正文首条非空文本生成回退标题
- **AND** 若正文也没有有效文本，系统 MUST 提供稳定的默认标题

#### Scenario: image insertion supports preview and removal

- **WHEN** 用户通过上传、粘贴或拖拽向 note 中插入图片
- **THEN** 系统 MUST 在保存前提供图片预览
- **AND** 用户 MUST 可以移除单张待保存图片

#### Scenario: formatting survives save and reopen

- **WHEN** 用户在 note 正文中使用 heading、list、quote、code block、bold、italic 或换行等格式
- **THEN** note 保存并重新打开后 MUST 保留相同的格式语义

#### Scenario: selected note opens in the focused editor

- **WHEN** 用户在 active list 中选择或新建 note
- **THEN** workbench MUST 展示可编辑的 title、Markdown body 与附件 controls
- **AND** selected list item MUST 保持稳定可见且具有明确 selected state

### Requirement: Query MUST Be Collection-Scoped And Fast To Scan

系统 MUST 在 `便签池` 与 `便签归档` 内分别提供关键词查询，并返回适合快速扫描的结果信息。

#### Scenario: searching in pool only returns active notes

- **WHEN** 用户位于 `便签池` 并输入查询关键词
- **THEN** 系统 MUST 仅搜索 active notes
- **AND** 结果 MUST 展示标题、摘要片段、更新时间与图片数量等轻量信息

#### Scenario: searching in archive only returns archived notes

- **WHEN** 用户位于 `便签归档` 并输入查询关键词
- **THEN** 系统 MUST 仅搜索 archived notes
- **AND** 系统 MUST NOT 在 archive 结果中混入 active notes

#### Scenario: search state remains stable during async refresh

- **WHEN** 用户快速修改 query 或切换 collection
- **THEN** 最新 query/collection 对应的结果 MUST 成为可见结果
- **AND** stale response MUST NOT 覆盖较新的结果或造成 controls 跳动

### Requirement: Archive Flow MUST Be Reversible

系统 MUST 支持把 active note 归档，并把 archived note 恢复回 active pool。

#### Scenario: archive an active note

- **WHEN** 用户对 `便签池` 中的 note 执行 archive
- **THEN** 该 note MUST 从 active pool 消失
- **AND** 该 note MUST 出现在 `便签归档`

#### Scenario: restore an archived note

- **WHEN** 用户对 `便签归档` 中的 note 执行 restore
- **THEN** 该 note MUST 返回 `便签池`
- **AND** 其正文、图片与 identity MUST 保持连续

### Requirement: Permanent Delete MUST Stay Lightweight But Explicit

系统 MUST 提供物理删除入口，并在删除 note 时同步移除其本地图片资产。

#### Scenario: deleting a note permanently removes it from the surface

- **WHEN** 用户对 active 或 archived note 执行永久删除
- **THEN** 该 note MUST 从当前 surface 消失
- **AND** 系统 MUST 以轻量确认方式提示此操作不可撤销

### Requirement: Workspace Note Card Surface MUST Keep Empty And Preview States Stable

#### Scenario: empty note pool card keeps layout baseline

- **WHEN** the current workspace has no active note cards
- **THEN** the note-card pool surface SHALL render an intentional empty state card
- **AND** the empty state SHALL NOT collapse, overlap toolbar controls, or create broken spacing

#### Scenario: note image preview supports cross-surface attachment paths

- **WHEN** a note card contains local image attachments from paste, drag, upload, or restored storage metadata
- **THEN** the preview SHALL use the shared local image/preview contract
- **AND** missing or unavailable images SHALL degrade to an explanatory fallback rather than breaking the note list

### Requirement: Note Workbench MUST Use Responsive Master-Detail Navigation

系统 MUST 在宽 note surface 中同时提供可扫描 note list 与 focused detail pane，并在空间不足时保持 controls 可达。

#### Scenario: wide note surface uses side-by-side list and detail

- **WHEN** note workbench 具有足够横向空间
- **THEN** 系统 MUST 在左侧稳定 list rail 中展示当前 collection
- **AND** 系统 MUST 在右侧 detail pane 中展示 active editor 或 archive preview
- **AND** list selection MUST NOT 因 detail 内容高度变化而跳动

#### Scenario: narrow note surface falls back without overlap

- **WHEN** note workbench 宽度不足以容纳稳定 Master-Detail
- **THEN** 系统 MUST 回退为上下结构
- **AND** search、collection、list、editor 与 primary action MUST 保持可达且不重叠

### Requirement: Active Note Draft MUST Be Protected During Surface Navigation

系统 MUST 识别 active note editor 的未保存变更，并禁止 surface 内 navigation 静默覆盖 draft。

#### Scenario: selecting another note with a dirty draft requires an explicit decision

- **WHEN** 用户修改 title、Markdown body 或 attachments 后选择另一 note
- **THEN** 系统 MUST 明确询问是否放弃未保存变更
- **AND** 用户取消时 MUST 保留当前 selection、draft 与 attachments

#### Scenario: collection and new-note navigation use the same draft guard

- **WHEN** dirty draft 存在且用户切换 active/archive collection、创建新 note、清空 editor 或归档当前 note
- **THEN** 系统 MUST 复用相同 discard guard
- **AND** 系统 MUST NOT 因 search result 暂时排除 selected note 而清空当前 editor

#### Scenario: save failure preserves retryable input

- **WHEN** create 或 update request 失败
- **THEN** 系统 MUST 保留 title、body 与 attachment drafts
- **AND** 系统 MUST 显示可访问的失败状态与可重试 save action

### Requirement: Note Save State MUST Be Explicit And Keyboard Accessible

系统 MUST 让用户能够判断当前 note 是否需要保存，并提供 desktop keyboard path。

#### Scenario: draft and save lifecycle is announced

- **WHEN** active editor 在 clean、dirty、saving、saved 或 error 状态之间变化
- **THEN** 系统 MUST 显示对应状态
- **AND** async status MUST 通过 polite live region 对 assistive technology 可感知

#### Scenario: keyboard save reuses the primary save contract

- **WHEN** focus 位于 note workbench 且用户按下 `Cmd/Ctrl+S`
- **THEN** 系统 MUST 阻止 browser default save behavior
- **AND** 系统 MUST 调用与 save button 相同的 create/update path

### Requirement: Archive And Delete Actions MUST Reflect Reversibility

系统 MUST 让 reversible archive 与 permanent delete 在交互层级上保持清晰差异。

#### Scenario: archived note can be undone from feedback

- **WHEN** 用户归档 active note 且 request 成功
- **THEN** 系统 MUST 显示带 Undo action 的短时 feedback
- **AND** Undo MUST restore 相同 note identity、正文与 attachments

#### Scenario: permanent delete is secondary and confirmed

- **WHEN** 用户打开 note row 的 overflow actions
- **THEN** permanent delete MUST 作为 secondary destructive action 展示
- **AND** 执行前 MUST 继续使用 explicit confirmation

### Requirement: Active Note MUST Be Referencable From The Current Composer

系统 MUST 为 active note 提供显式的 Composer reference action，并复用现有 selected note context contract。

#### Scenario: reference action selects the note in the visible Composer

- **WHEN** 用户在 active note detail 中执行“引用到对话”
- **THEN** 系统 MUST 将该 note idempotently 加入当前 visible Composer 的 selected note cards
- **AND** Composer MUST 获得 focus 且当前 thread/workspace MUST 保持不变
- **AND** 系统 MUST NOT 把完整 note body 复制进 draft text

### Requirement: Note Split Preference MUST Support Pointer Keyboard And Reset

系统 MUST 让 conversation/note separator 在不同输入方式下共享同一合法 ratio contract。

#### Scenario: valid split ratio persists across remount

- **WHEN** 用户通过 pointer 或 keyboard 调整 note split 并结束 interaction
- **THEN** 系统 MUST 将合法 ratio 写入 layout preference
- **AND** note center surface 再次 mount 时 MUST 恢复该 ratio

#### Scenario: separator supports keyboard adjustment and default reset

- **WHEN** separator focused 且用户使用 Arrow keys、Home 或 double click
- **THEN** Arrow keys MUST 在合法范围内增减 ratio
- **AND** Home 或 double click MUST 恢复 conversation : note = `1:2`
- **AND** separator MUST 暴露 orientation、min、max 与 current value semantics
