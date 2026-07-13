## ADDED Requirements

### Requirement: Sparse Added-File Facts MUST Preserve Canonical Diff Access

当 conversation file-change fact 表示新增文件但不携带 inline diff 时，消息幕布 MUST 在不改变其他 change kind 行为的前提下，复用已有 Workspace Git diff navigation 保持该文件的 canonical diff 可达性。

#### Scenario: added file without inline diff opens canonical Git diff

- **WHEN** 消息幕布收到 normalized kind 为 `added`、包含有效 `filePath`、但缺少 inline diff 的 file-change entry
- **AND** tool output 为空或不满足 structured diff header contract
- **AND** 当前 surface 提供 `onOpenDiffPath`
- **THEN** 用户激活该 row MUST 调用 `onOpenDiffPath(filePath)`
- **AND** 系统 MUST NOT 从 shell command 文本或当前磁盘内容伪造 event-time inline diff
- **AND** 普通 CLI/Markdown output MUST NOT 被计入 diff `additions/deletions`

#### Scenario: added file with inline diff keeps inline preview priority

- **WHEN** 新增文件 entry 已携带可解析的 inline diff
- **THEN** 用户激活该 row MUST 展开现有 inline preview
- **AND** 系统 MUST NOT 同时触发 Workspace Git diff navigation

#### Scenario: other change kinds preserve existing missing-diff behavior

- **WHEN** `modified`、`deleted` 或 `renamed` entry 缺少 inline diff
- **THEN** 系统 MUST 保持其现有 row behavior
- **AND** added-file fallback MUST NOT 被应用到这些 change kind

#### Scenario: navigation callback is unavailable

- **WHEN** 新增文件 entry 缺少 inline diff 且当前 surface 未提供 `onOpenDiffPath`
- **THEN** row MUST 保持稳定的非交互展示
- **AND** 系统 MUST NOT 抛出 runtime error
