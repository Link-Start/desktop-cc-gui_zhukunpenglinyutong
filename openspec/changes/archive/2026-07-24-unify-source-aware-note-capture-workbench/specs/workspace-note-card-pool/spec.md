## MODIFIED Requirements

### Requirement: Quick Capture MUST Support Formatted Copy And Images

系统 MUST 在中央 note workbench 中支持显式快速录入 note card，包含格式化文案、图片插入与 source-aware capture draft；默认浏览状态 MUST NOT 长期渲染创建 inputs。

#### Scenario: default workbench does not show a creation form

- **WHEN** 用户正常打开 note workbench 且没有 creating/editing request
- **THEN** workbench MUST 展示 searchable list 与 idle 或 read-only detail
- **AND** title input、Markdown input、attachment controls 与 save action MUST NOT 默认显示

#### Scenario: explicit new action opens the creation form

- **WHEN** 用户点击“新建便签”
- **THEN** workbench MUST 在 detail pane 进入 creating state
- **AND** workbench MUST 展示 title、Markdown body、attachment、save 与 cancel controls

#### Scenario: user saves a quick note without leaving the current workspace flow

- **WHEN** 用户在 creating state 输入标题和正文并保存
- **THEN** 系统 MUST 将该 note 保存到当前项目的 `便签池`
- **AND** 用户 MUST 无需离开当前 workspace 或 thread 才能完成记录
- **AND** 保存成功后 workbench MUST 进入该 note 的 read-only viewing state

#### Scenario: title can fall back from content

- **WHEN** 用户保存 note 时未填写标题
- **THEN** 系统 MUST 使用正文首条非空文本生成回退标题
- **AND** 若正文也没有有效文本，系统 MUST 提供稳定的默认标题

#### Scenario: image insertion supports preview and removal

- **WHEN** 用户通过上传、粘贴或拖拽向 creating/editing note 中插入图片
- **THEN** 系统 MUST 在保存前提供图片预览
- **AND** 用户 MUST 可以移除单张待保存图片

#### Scenario: formatting survives save and reopen

- **WHEN** 用户在 note 正文中使用 heading、list、quote、code block、bold、italic 或换行等格式
- **THEN** note 保存并重新打开后 MUST 保留相同的格式语义

#### Scenario: selected active note opens read-only first

- **WHEN** 用户在 active list 中选择 note
- **THEN** workbench MUST 展示 read-only title、source summary、Markdown body、attachments 与 note actions
- **AND** title/body inputs MUST NOT 因 selection 自动出现
- **AND** selected list item MUST 保持稳定可见且具有明确 selected state

#### Scenario: explicit edit action opens the editor

- **WHEN** 用户在 active note viewing state 点击编辑
- **THEN** workbench MUST 原位进入 editing state并展示 editable title、Markdown body 与附件 controls
- **AND** cancel MUST 恢复该 note 的 read-only viewing state

#### Scenario: capture request opens a prefilled creation form

- **WHEN** workbench 收到合法 `NoteCaptureDraft`
- **THEN** workbench MUST 进入 creating state并预填 title、body 与 source
- **AND** 保存失败时 MUST 保留这些 draft values供 retry

#### Scenario: archive collection stays read-only

- **WHEN** 用户位于 `便签归档` 并选择 archived note
- **THEN** workbench MUST 进入 archived-preview state
- **AND** workbench MUST NOT 展示 new/edit form
- **AND** restore 与 permanent delete MUST 保持可用

## ADDED Requirements

### Requirement: Note Workbench MUST Expose Explicit Interaction States

系统 MUST 用可验证的 explicit state 区分 idle、viewing、creating、editing 与 archived-preview，不得仅依靠 inputs 是否为空推断用户任务。

#### Scenario: idle state uses a lightweight detail placeholder

- **WHEN** 当前 collection 没有 selected note 且没有 create/capture request
- **THEN** detail pane MUST 展示轻量引导或 collection empty state
- **AND** 系统 MUST NOT 用禁用 form controls 填充空白

#### Scenario: save returns to viewing

- **WHEN** creating 或 editing save 成功
- **THEN** workbench MUST 选择已保存 note 并进入 viewing state
- **AND** saved status MUST 保持可访问反馈

#### Scenario: cancel returns to the previous stable state

- **WHEN** 用户取消 creating 或 editing
- **THEN** workbench MUST 清理未持久化 capture/attachment draft
- **AND** workbench MUST 回到之前的 viewing state 或 idle

### Requirement: Note Detail MUST Present Source Without Polluting Body

系统 MUST 在 note detail 中独立呈现 optional source summary，不得为了显示来源而修改用户正文。

#### Scenario: code source summary is readable

- **WHEN** selected note source kind 为 code selection
- **THEN** detail MUST 展示 path 与 line range
- **AND** language 可用时 MUST 作为 secondary metadata 展示

#### Scenario: code source summary opens the captured file range

- **WHEN** 用户通过 pointer 或 keyboard 激活 code source summary
- **THEN** 系统 MUST 使用 workspace-relative path 打开对应文件
- **AND** editor MUST 定位到 source start line
- **AND** editor MUST 恢复 source start line 到 end line 的选中范围

#### Scenario: unavailable code source preserves the note

- **WHEN** source file 已移动、删除或不可读取
- **THEN** 系统 MUST 复用现有 editor file-open error behavior
- **AND** note detail 与 stored source MUST 保持可读且不得被静默清理

#### Scenario: conversation source summary is readable

- **WHEN** selected note source kind 为 conversation selection 或 conversation thread
- **THEN** detail MUST 展示 conversation source type 与可用 capture metadata
- **AND** 系统 MUST NOT 声称已经支持无法执行的精确 backlink navigation

#### Scenario: fenced code uses the shared rich renderer

- **WHEN** selected note body 包含 fenced code
- **THEN** detail MUST 复用现有 Markdown message code renderer
- **AND** renderer MUST 保留 language、syntax highlighting、line numbers 与 copy action
- **AND** note feature MUST NOT 引入第二套 syntax highlighter

#### Scenario: new code captures do not duplicate structured source in the body

- **WHEN** 系统为 code selection 构造新的 `NoteCaptureDraft`
- **THEN** body MUST 只包含 safe fenced code 与用户选择内容
- **AND** path、line range 与 language MUST 由 structured source summary 呈现
- **AND** 既有 note body MUST NOT 因该规则被迁移或重写

#### Scenario: legacy note has no source

- **WHEN** selected legacy note 不包含 source
- **THEN** detail MUST 正常展示 title、body 与 attachments
- **AND** source summary 缺失 MUST NOT 被当作 load error

### Requirement: Note Workbench MUST Support Layout-Level Maximize

系统 MUST 提供显式 maximize/restore action，使便签工作台可以占满中央 workspace content，而不改变 native window、main topbar 或 right panel。

#### Scenario: maximize covers the conversation companion

- **WHEN** 用户在 notes center 激活 workbench maximize action
- **THEN** note layer MUST 占满原 conversation + note split 的中央宽度
- **AND** conversation companion 与 split divider MUST 不可见
- **AND** right panel 与 main topbar MUST 保持可见、可交互

#### Scenario: hidden conversation is not interactive

- **WHEN** workbench 处于 maximized state
- **THEN** conversation companion MUST 标记为 `aria-hidden`
- **AND** conversation companion MUST 设置 `inert`
- **AND** 当前焦点若位于 conversation companion 内 MUST 被移出

#### Scenario: restore preserves split and mounted state

- **WHEN** 用户激活 restore action
- **THEN** workbench MUST 恢复进入最大化前的 split ratio
- **AND** conversation subtree MUST 在 maximize/restore 期间保持 mounted
- **AND** note selection、creating/editing draft 与 conversation state MUST 不因 layout toggle 丢失

#### Scenario: leaving notes clears maximize state

- **WHEN** center mode 从 notes 切换到其他 surface
- **THEN** transient maximize state MUST 自动 reset
- **AND** 用户再次进入 notes center 时 MUST 看到常规 split layout
