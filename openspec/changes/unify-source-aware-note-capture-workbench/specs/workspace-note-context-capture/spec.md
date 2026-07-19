## ADDED Requirements

### Requirement: Context Capture MUST Produce A Unified Note Draft

系统 MUST 将 code selection、conversation selection 与 conversation semantic transcript 归一为同一 `NoteCaptureDraft` contract，并通过现有 note workbench 创建流程保存。

#### Scenario: capture opens a prefilled note draft

- **WHEN** 用户从受支持的 code 或 conversation surface 执行“保存到便签…”
- **THEN** 系统 MUST 打开当前 workspace 的 note workbench creating state
- **AND** 系统 MUST 预填 title、Markdown body 与 structured source metadata
- **AND** 系统 MUST NOT 在 context-menu handler 中直接创建持久化 note

#### Scenario: capture keeps workspace and thread context

- **WHEN** capture request 打开 note workbench
- **THEN** 当前 workspace 与 thread identity MUST 保持不变
- **AND** conversation column 与 Composer MUST 继续遵循现有 notes split behavior

#### Scenario: dirty note draft is not silently replaced

- **WHEN** note workbench 已存在 dirty creating/editing draft 且新 capture request 到达
- **THEN** 系统 MUST 复用现有 discard decision
- **AND** 用户取消替换时 MUST 保留原 draft
- **AND** 被拒绝的 capture request MUST NOT 在 workbench remount 后自动重放

### Requirement: Code Selection Capture MUST Preserve Code And Location

系统 MUST 从现有 file edit/preview selection facts 捕获代码，不得通过重新解析 rendered syntax DOM 推断正文或行号。

#### Scenario: edit-mode selection becomes fenced code

- **WHEN** 用户在 CodeMirror edit mode 选择非空代码并执行保存到便签
- **THEN** draft body MUST 包含精确 selection 的 fenced code
- **AND** source MUST 记录 workspace-relative path、start line、end line 与可用 language

#### Scenario: preview line range becomes fenced code

- **WHEN** 用户在 code preview mode 选择一个或多个完整行并执行保存到便签
- **THEN** draft body MUST 使用 canonical document snapshot 中对应行文本
- **AND** source line range MUST 与 visible selected range 一致

#### Scenario: empty editor selection does not imply a capture

- **WHEN** edit mode 只有 cursor 且没有非空 selection
- **THEN** 系统 MUST NOT 将 cursor line 或整份文件静默转换为 note draft

#### Scenario: annotation behavior remains available

- **WHEN** note capture 被接入 file selection surface
- **THEN** 现有 annotate-for-AI、annotation marker、remove annotation 与 line-selection behavior MUST 保持可用

### Requirement: Conversation Selection Capture MUST Preserve Explicit User Selection

系统 MUST 支持对话幕布内局部文本 selection，并将用户明确选择的文本捕获为 note draft。

#### Scenario: selection inside one message is captured

- **WHEN** 用户在当前 conversation canvas 的一条 message 内选择非空文本并右键
- **THEN** context menu MUST 提供保存选中文本到便签
- **AND** draft body MUST 使用 capture 时冻结的 selection text
- **AND** source MUST 记录 current thread id 与对应 message item id

#### Scenario: selection across multiple message rows is attributed

- **WHEN** selection range 跨越当前 canvas 的多条 message rows
- **THEN** draft body MUST 保留 selection text 的顺序
- **AND** source item ids MUST 记录实际被 range 覆盖的 message identities

#### Scenario: selection outside the canvas is ignored

- **WHEN** selection 的任一有效 range 不属于当前 conversation canvas
- **THEN** conversation context menu MUST NOT 把该 selection 标记为 conversation note source

#### Scenario: existing link and action menus keep ownership

- **WHEN** context-menu event 已被 file link、interactive control 或其他现有 menu owner 处理
- **THEN** conversation note capture MUST NOT 抢占或重复打开 context menu

### Requirement: Whole Conversation Capture MUST Use Semantic Transcript Policy

系统 MUST 从 canonical normalized `ConversationItem` 生成 current thread semantic transcript，不得从 rendered DOM 或 raw provider transcript 构造整段便签。

#### Scenario: semantic transcript includes durable dialogue

- **WHEN** 用户执行保存整段对话到便签
- **THEN** draft MUST 按时间顺序包含 user-authored visible messages 与 finalized assistant responses
- **AND** Markdown code blocks MUST 保持其正文语义

#### Scenario: semantic transcript includes final result rows

- **WHEN** canonical conversation 包含 completed diff 或 completed review result
- **THEN** semantic transcript MUST 以有界 Markdown section 包含这些最终结果

#### Scenario: semantic transcript excludes process noise

- **WHEN** canonical conversation 包含 reasoning、explore、tool execution、approval/control rows 或 presentation-only state
- **THEN** semantic transcript MUST 排除这些内容

#### Scenario: active streaming text is not treated as durable transcript

- **WHEN** 当前 assistant row 仍在 streaming 且未 final
- **THEN** whole-conversation capture MUST NOT 从 transient live text channel 读取或保存该 row
- **AND** 已 final 的历史 dialogue MUST 仍可被捕获

### Requirement: Conversation Capture Menu MUST Preserve Copy And Selection Stability

系统 MUST 在提供 note capture 时保留普通文本复制能力，并在菜单交互期间冻结 capture snapshot。

#### Scenario: selected text menu retains copy

- **WHEN** conversation selection 非空且合法
- **THEN** menu MUST 提供 Copy 与保存选中文本到便签
- **AND** Copy MUST 使用同一冻结 selection text

#### Scenario: whole-thread action remains available with a selection

- **WHEN** conversation selection 合法
- **THEN** menu MUST 同时允许用户保存整段 semantic transcript

#### Scenario: menu click does not depend on live DOM selection

- **WHEN** context menu 打开后 browser selection 因 focus change 收缩或消失
- **THEN** capture action MUST 使用 menu 打开时冻结的 text 与 item identities

### Requirement: Conversation Capture Menu MUST Expose A Bottom Action Trigger

系统 MUST 在最新 final assistant message 的底部 action group 最左侧提供 note capture icon，作为现有 conversation capture menu 的额外入口；note capture icon MUST 使用 9px visual size 与 1.75 stroke width，History MUST 使用 13px visual size，Copy 与 Fork 的既有视觉尺寸与样式 MUST 保持不变。

#### Scenario: bottom icon opens the shared capture menu

- **WHEN** 用户激活幕布最底部最新 final assistant message 的 note capture icon
- **THEN** 系统 MUST 打开与幕布右键相同的 conversation capture menu
- **AND** menu item MUST 继续使用现有 semantic transcript 与 `NoteCaptureDraft` 路由
- **AND** note capture icon MUST 位于 Copy、Fork 与 Rewind 之前

#### Scenario: existing context-menu trigger remains unchanged

- **WHEN** bottom action trigger 可用
- **THEN** 幕布原有 context-menu trigger、selection snapshot 与 interactive-control ownership MUST 保持不变

#### Scenario: historical final boundaries stay compact

- **WHEN** 幕布包含多个 final assistant boundaries
- **THEN** note capture icon MUST 只出现在最新 final assistant boundary
- **AND** 既有 Copy、Fork 与 Rewind action availability MUST 保持不变

### Requirement: Code Source Navigation MUST Preserve The Note Workbench Companion

系统 MUST 在从已保存 code note 的 source summary 打开文件时维持 note workbench 可见，并限定该布局语义只属于 source-origin navigation。

#### Scenario: saved code source opens beside the note workbench

- **WHEN** 用户在只读 note detail 点击合法 `codeSelection` source
- **THEN** 系统 MUST 在 Editor 中打开并定位对应文件
- **AND** note workbench MUST 留在左侧替换 conversation companion
- **AND** right panel 与 main topbar MUST 保持可用

#### Scenario: note state survives source navigation

- **WHEN** source-origin Editor 打开、切换 file tab 或返回 notes
- **THEN** selected note、query、list state 与未保存 draft MUST 保持
- **AND** note panel MUST NOT 因 `notes -> editor` transition 被卸载重建

#### Scenario: source-origin editor exits back to notes

- **WHEN** notes 是当前 Editor companion 且用户退出 Editor 或关闭最后一个 file tab
- **THEN** center MUST 返回 notes workbench
- **AND** conversation MUST NOT 被意外选为返回目标

#### Scenario: ordinary file navigation remains compatible

- **WHEN** 文件由 file tree、global search、conversation file link、Git 或其他普通入口打开
- **THEN** 系统 MUST 保持现有 chat/project-map companion behavior
- **AND** 普通入口 MUST NOT 因存在已打开 note 而隐式切换为 notes companion

#### Scenario: maximize is unavailable in editor companion mode

- **WHEN** note workbench 作为 Editor companion 显示
- **THEN** source navigation 前的 transient note maximize state MUST 已清理
- **AND** workbench MUST NOT 显示不可执行的 maximize action
