## ADDED Requirements

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
