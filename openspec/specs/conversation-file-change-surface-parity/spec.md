# conversation-file-change-surface-parity Specification

## Purpose

Defines the conversation-file-change-surface-parity behavior contract, covering Conversation File-Change Facts MUST Normalize Into Shared Canonical Entries.
## Requirements
### Requirement: Conversation File-Change Facts MUST Normalize Into Shared Canonical Entries

系统 MUST 在消息幕布、右侧 `workspace session activity`、底部 `status panel` 读取 conversation file-change 事实前，先归一为共享 canonical file entries。

#### Scenario: multi-file change produces complete canonical entries

- **WHEN** 同一次 conversation file-change fact 包含多个受影响文件
- **THEN** 系统 MUST 为每个文件生成独立 canonical entry
- **AND** canonical entry MUST 至少包含 `filePath`、`status`、`additions`、`deletions`
- **AND** bundle aggregate MUST 与这些 entries 可追溯一致

#### Scenario: sparse historical payload uses shared fallback extraction

- **WHEN** 历史 replay 的 file-change payload 缺少部分 diff 或 path 证据
- **THEN** 系统 MAY 使用 fallback extraction
- **AND** 该 fallback MUST 由共享 canonical adapter 统一完成
- **AND** 不同 surface MUST NOT 各自推断出不同的文件集合或 `+/-`

### Requirement: Conversation File-Change Surfaces MUST Stay In Parity

同一 conversation file-change fact 在消息幕布、右侧 activity panel、底部 status panel 的文件数量与 diff 统计 MUST 保持一致。

#### Scenario: file counts match across all surfaces

- **WHEN** 同一 file-change fact 同时出现在消息幕布、右侧 activity panel、底部 status panel
- **THEN** 三个 surface MUST 展示相同的受影响文件数量
- **AND** 右侧 activity panel MUST NOT 因 summary 压缩而少展示文件

#### Scenario: per-file stats match across all surfaces

- **WHEN** 同一路径在多个 surface 上被渲染
- **THEN** 该路径的 `status`、`additions`、`deletions` MUST 保持一致
- **AND** 系统 MUST 继续以 `filePath` 作为跨 surface 的 canonical identity

#### Scenario: aggregate additions and deletions are normalized

- **WHEN** surface 需要显示某次 file-change event 或当前 thread 的 aggregate `+/-`
- **THEN** aggregate MUST 来自同一 canonical entries source
- **AND** 消息幕布 header、右侧 summary、底部 `Edits` 汇总 MUST 保持一致

### Requirement: Surface Parity MUST Survive History Reopen And Replay

系统 MUST 在 conversation 历史 reopening / replay 场景下继续保持 file-change parity，而不是只在实时阶段一致。

#### Scenario: reopened conversation keeps the same file-change parity

- **WHEN** 用户重新打开一个已存在 file-change 历史的 conversation
- **THEN** 消息幕布、右侧 activity panel、底部 status panel MUST 继续展示一致的文件数量与 `+/-`
- **AND** 系统 MUST NOT 在历史 reopening 后退化为只剩 summary 或不完整文件列表

### Requirement: Each turn can expose a file-change summary card

Conversation timeline MUST 将一个 turn 的 canonical file-change facts 聚合为 turn-level summary card，并 MUST 与其他 file-change surfaces 使用同一 entries/stats truth。

#### Scenario: Render a turn with changed files

- **WHEN** completed or active turn 包含一个或多个 canonical file-change entries
- **THEN** timeline MUST 展示一次 turn-level summary，且 file count 与 additions/deletions MUST 与共享 facts 一致

### Requirement: Pending next turn does not detach the prior file-change card

当新 turn 已 pending 但尚未形成稳定 timeline content 时，前一 turn 的 file-change summary MUST 保持与其 owner turn 绑定，不得漂移或消失。

#### Scenario: Queue a new turn after file changes

- **WHEN** 前一 turn 有 file-change summary 且下一 turn 进入 pending
- **THEN** 前一 summary card MUST 保持可见并归属于原 turn，直到正常 timeline projection 接管

### Requirement: Turn File Summary Rows MUST Request Modal Diff Preview

conversation turn 与 session file summary 中的文件行在 host 提供 preview capability 时 MUST 成为 accessible modal diff action，并且 MUST 保持 conversation Surface 不变。

#### Scenario: pointer activation opens modal request

- **WHEN** 用户点击“已编辑 N 个文件”卡片中的可见文件行
- **THEN** 系统 MUST 使用该文件的完整 workspace-relative path 发出 modal diff preview request
- **AND** request MUST 要求 modal 初始最大化
- **AND** 系统 MUST NOT 调用 center-panel `onOpenDiffPath`

#### Scenario: keyboard activation matches pointer behavior

- **WHEN** 用户聚焦 summary file button 并按 Enter 或 Space
- **THEN** 系统 MUST 发出与 pointer activation 相同的 modal preview request

#### Scenario: show-more remains independent

- **WHEN** 用户激活“再显示 N 个文件”
- **THEN** 系统 MUST 只展开隐藏文件
- **AND** MUST NOT 发出任何 modal diff preview request

#### Scenario: preview capability unavailable

- **WHEN** host 未提供 modal preview callback
- **THEN** summary files MUST 保持稳定的非交互展示
- **AND** 系统 MUST NOT 抛出 runtime error

#### Scenario: both summary placements share the action

- **WHEN** 文件汇总渲染在历史回合边界或 timeline 末尾会话累计位置
- **THEN** 两种 placement MUST 提供相同的 modal preview behavior

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

