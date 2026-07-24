# workspace-note-card-storage Specification

## Purpose

Defines the workspace-note-card-storage behavior contract, covering Note Cards MUST Be Stored Under Project-Scoped Local Folders.
## Requirements
### Requirement: Note Cards MUST Be Stored Under Project-Scoped Local Folders

系统 MUST 将 note card 数据存储到用户电脑 `~/.ccgui/note_card/<project-name>/` 下，并按 `active` / `archive` 目录区分活跃与归档集合。

#### Scenario: first save initializes project note-card folders

- **WHEN** 用户首次在某个项目中保存 note card
- **THEN** 系统 MUST 创建 `~/.ccgui/note_card/<project-name>/active/`
- **AND** 系统 MUST 创建 `~/.ccgui/note_card/<project-name>/archive/`

#### Scenario: project folder name derives from project name safely

- **WHEN** 系统为某个项目解析 note card 存储目录
- **THEN** 目录名 MUST 来源于当前项目名
- **AND** 系统 MUST 对目录名执行 filesystem-safe sanitization

### Requirement: Note Documents MUST Preserve Formatted Body And Image Attachments

系统 MUST 以结构化 note document 持久化正文与图片附件，确保 reopen、query 与 reference 都可复用同一份 canonical data。

#### Scenario: formatted body is stored as canonical note content

- **WHEN** 用户保存包含格式化文案的 note
- **THEN** 系统 MUST 持久化该 note 的 canonical body content
- **AND** reopen 后 MUST 能恢复相同的格式语义

#### Scenario: image assets are stored inside the project note-card area

- **WHEN** 用户保存包含图片的 note
- **THEN** 系统 MUST 将图片文件保存到当前项目的 note-card 存储区域
- **AND** note document MUST 记录稳定的 attachment references

### Requirement: Archive MUST Use Physical Collection Separation

系统 MUST 通过 active/archive 集合切换表达归档状态，而不是仅依赖前端临时过滤。

#### Scenario: archiving moves the note into archive collection

- **WHEN** 某条 active note 被归档
- **THEN** 该 note 的持久化文档 MUST 从 active collection 迁移到 archive collection
- **AND** note id MUST 保持不变

#### Scenario: restoring moves the note back into active collection

- **WHEN** 某条 archived note 被恢复
- **THEN** 该 note 的持久化文档 MUST 回到 active collection
- **AND** 图片资产引用 MUST 继续有效

### Requirement: Preview And Delete MUST Respect The Note Card Storage Area

系统 MUST 正确预览和清理 `~/.ccgui/note_card/<project-name>/` 下的图片资产。

#### Scenario: preview can fall back for note-card-local images

- **WHEN** note surface 回显位于 `~/.ccgui/note_card/**` 的本地图片
- **THEN** 系统 MUST 提供稳定的预览结果
- **AND** MUST NOT 假设图片一定与 workspace 根目录同源

#### Scenario: permanent delete cleans the note asset folder

- **WHEN** 用户永久删除某条 note
- **THEN** 对应的 note document MUST 被物理删除
- **AND** `assets/<note-id>/` MUST 一起被清理

### Requirement: Storage MUST Expose Lightweight Query Projection

系统 MUST 为 note list/query 返回 lightweight projection，避免每次列表扫描都加载完整正文或图片二进制。

#### Scenario: list query returns note projections without binary image payload

- **WHEN** note card surface 请求列表或搜索结果
- **THEN** 存储层 MUST 返回标题、摘要片段、更新时间、图片数量和归档状态等轻量字段
- **AND** 系统 MUST NOT 为普通列表查询读取图片二进制内容

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

