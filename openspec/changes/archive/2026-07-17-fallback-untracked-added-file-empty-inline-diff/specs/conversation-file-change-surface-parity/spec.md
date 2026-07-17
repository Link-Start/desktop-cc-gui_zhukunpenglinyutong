## MODIFIED Requirements

### Requirement: Added-File Facts MUST Preserve Conversation Surface Behavior

当 conversation file-change fact 已携带新增文件的 event-time patch content 时，消息幕布 MUST 在原 Surface 内提供 inline diff，不得因 patch format 差异隐式导航到 Workspace Git diff。

#### Scenario: apply_patch added file expands inline

- **WHEN** normalized kind 为 `added` 的 entry 携带 `*** Add File: <path>` 与后续 `+content`
- **THEN** 用户激活该 row MUST 在 conversation canvas 原地展开
- **AND** inline preview MUST 展示 preview limit 内的新增正文行
- **AND** 系统 MUST NOT 调用 `onOpenDiffPath`

#### Scenario: unified added-file diff keeps inline behavior

- **WHEN** 新增文件 entry 携带包含 hunk 与可渲染 edit content 的 unified diff
- **THEN** 用户激活该 row MUST 展开现有 inline preview
- **AND** 系统 MUST NOT 触发 Workspace Git diff navigation

#### Scenario: missing inline diff preserves existing fallback

- **WHEN** added-file entry 完全缺失 inline diff
- **THEN** 系统 MUST 保持变更前已有的 optional canonical fallback behavior
- **AND** 本变更 MUST NOT 扩大到其他 change kind 或其他点击入口

#### Scenario: conversation summary remains independent

- **WHEN** file-change row 采用 unified 或 apply_patch inline preview
- **THEN** `TurnFilesChangedCard` 的聚合与完成边界 MUST 保持不变
- **AND** preview activation MUST NOT 通过 Surface navigation 使 conversation timeline 被替换

#### Scenario: patch content remains event-time stable

- **WHEN** 历史 file-change row 被重新渲染
- **THEN** inline preview MUST 仅消费事件携带的 patch content
- **AND** 系统 MUST NOT 读取当前磁盘内容覆盖历史 fact

## RENAMED Requirements

- FROM: `### Requirement: Sparse Added-File Facts MUST Preserve Canonical Diff Access`
- TO: `### Requirement: Added-File Facts MUST Preserve Conversation Surface Behavior`
