## ADDED Requirements

### Requirement: Note Documents MUST Preserve Optional Structured Source

系统 MUST 在 note document 中以 optional structured field 持久化 capture source，并允许无 source 的既有 note 继续使用全部 CRUD lifecycle。

#### Scenario: captured note stores code source

- **WHEN** note create input 包含合法 code selection source
- **THEN** persisted note MUST 保存 path、start line、end line 与可用 language
- **AND** get/reopen MUST 返回等价 source

#### Scenario: captured note stores conversation source

- **WHEN** note create input 包含合法 conversation selection 或 conversation thread source
- **THEN** persisted note MUST 保存 thread identity 与对应 item/count/capture metadata
- **AND** source MUST NOT 重复存储完整 note body

#### Scenario: legacy note without source remains compatible

- **WHEN** storage 读取不含 `source` field 的旧 note JSON
- **THEN** source MUST 解析为 absent
- **AND** list、get、update、archive、restore 与 delete MUST 继续遵循现有 contract

#### Scenario: normal editing preserves source attribution

- **WHEN** 用户更新 captured note 的 title、body 或 attachments
- **THEN** original source MUST 保持不变
- **AND** update path MUST NOT 因调用方未发送 source 而清空 attribution

### Requirement: Structured Note Source MUST Be Validated At Create Boundary

系统 MUST 在 note create trust boundary 验证 optional source，防止持久化伪造或不可解析的 attribution。

#### Scenario: valid code range is accepted

- **WHEN** code source path 非空且 `startLine >= 1`、`endLine >= startLine`
- **THEN** create MUST 接受并持久化 normalized source

#### Scenario: invalid code source is rejected

- **WHEN** code source path 为空、start line 小于 1 或 end line 小于 start line
- **THEN** create MUST 返回显式错误
- **AND** 系统 MUST NOT 静默保存为无 source note

#### Scenario: conversation identities are normalized

- **WHEN** conversation source 包含 thread id 与 item ids
- **THEN** thread id MUST trim 且保持非空
- **AND** item ids MUST 去除空值与重复值并保持有界

#### Scenario: ordinary note without source remains valid

- **WHEN** create input 未提供 source
- **THEN** 系统 MUST 按现有 note create contract 保存 note
