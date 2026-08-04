# subagent-session-tree-navigation Specification (delta)

## Purpose

把会话树 subAgent 父子层级从 Claude pending 投影扩展到 Grok、Codex 与 Shared Session 场景。

## ADDED Requirements

### Requirement: Grok session list exposes parent linkage

`list_grok_sessions` MUST 扫描 `subagents/` 元数据并为子会话输出 `parentSessionId` 与 `sessionKind`，前端 merge 时 MUST 据此写入 `parentThreadId` 并同步 `threadParentById`。

#### Scenario: grok subagent sessions nested under parent

- **WHEN** Grok 父会话通过 `spawn_subagent` 产生 3 个 `session_kind=subagent` 子会话
- **THEN** 会话列表 MUST 在父会话下嵌套展示 3 个子代理行（带子代理标识）

#### Scenario: merge preserves late-arriving parent metadata

- **WHEN** 本地 live 线程 `updatedAt` 较新但 list 带来了此前缺失的 `parentSessionId`
- **THEN** merge MUST 仍补上 `parentThreadId`，不得整段跳过

### Requirement: Codex child threads auto-link parent

识别到 Codex 子会话的 `parent_thread_id` 元数据时，系统 MUST 自动建立父子关系。

#### Scenario: collab spawned thread appears nested

- **WHEN** collab spawn 产生带 `parent_thread_id` 的子 session
- **THEN** 会话树 MUST 将子会话挂在父会话下

### Requirement: Shared parent replaces hidden native owner

Shared 场景下，子会话 parent 指向被隐藏的 native owner 时，系统 MUST 将会话树上的挂载点改为对应 `shared:` 父会话。

#### Scenario: shared grok children re-parented

- **WHEN** Shared Grok 会话的子代理 parent 是 hidden 的 `grok:` owner
- **THEN** 会话树 MUST 把子代理挂在 `shared:` 父会话下
- **AND** 详情/点击导航 MUST 使用与侧栏一致的子会话 id
