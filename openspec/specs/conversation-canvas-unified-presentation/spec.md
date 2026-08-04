# conversation-canvas-unified-presentation Specification

## Purpose

TBD - created by archiving change. Update Purpose for `conversation-canvas-unified-presentation`.

## Requirements

### Requirement: Conversation canvas defaults to readable content without row-level lightweight summary

The conversation canvas MUST render assistant messages and tool rows with full presentation by default when corresponding ConversationItems exist. The system MUST NOT require the user to click a conversation-level or row-level control labeled for "render detail" / "详情已延迟" / "渲染详情" / "启用轻量模式" in order to see primary message or tool-group content.

#### Scenario: long conversation remains readable without lightweight prompt

- **WHEN** a conversation exceeds historical oversized or heavy-row thresholds
- **THEN** the canvas MUST NOT show the conversation lightweight suggestion/mode chrome as an active product path
- **AND** primary assistant text rows MUST remain presented as normal message rows rather than "详情已延迟" summary strips

#### Scenario: row-level deferred summary strip is not used

- **WHEN** timeline virtualization is enabled and a heavy projection row exists
- **THEN** the system MUST NOT render the lightweight row summary strip that only exposes a "渲染详情" action for that row's primary content
- **AND** the system MAY still use neutral height placeholders for off-screen virtualization

### Requirement: Block-level heavy content deferral remains allowed

The system MAY defer rendering of extremely heavy **in-row** Markdown islands (e.g. large tables) or heavy tool output blocks behind an explicit "显示详情" control. This block-level deferral MUST remain distinct from removed conversation/row-level lightweight summary walls.

#### Scenario: heavy markdown table can still use show-detail

- **WHEN** an assistant message contains a heavy Markdown table island that exceeds the block deferral policy
- **THEN** the system MAY show a block-level deferred placeholder with "显示详情"
- **AND** activating that control MUST reveal the deferred block content

### Requirement: Turn-settle scroll ownership is deterministic

After a turn completes and the live presentation window expands or layout height changes, the system MUST keep the viewport on the latest content when the user was following the bottom, and MUST NOT force scroll-to-bottom when the user has an active upward reading intent.

#### Scenario: bottom follower stays on latest after settle

- **WHEN** the user is near the bottom during streaming and the turn settles
- **THEN** the viewport MUST remain positioned to show the latest assistant content within the settle repin budget

#### Scenario: upward reader is not yanked on settle

- **WHEN** the user has recently scrolled upward away from the bottom
- **THEN** turn settle MUST NOT re-arm forced stick-to-bottom against that reading position

### Requirement: Multi-CLI live tool projection uses available engine signals

Engines MUST project live tools onto the canvas when signals exist. Grok MUST bridge tools from on-disk chat history when stdout lacks tool events. Kimi and OpenCode MUST continue projecting stream ToolStarted/ToolCompleted events. Absence of tools MUST NOT be explained as Claude/Codex-style command-card suppression.

#### Scenario: Grok live tools bridged from chat history

- **WHEN** a Grok live turn writes `tool_calls` / `tool_result` lines into `chat_history.jsonl` while stdout only emits text/thought/end
- **THEN** the runtime MUST emit ToolStarted/ToolCompleted for newly observed history lines during the turn
- **AND** the canvas MUST be able to render corresponding tool rows without waiting for a full session reload

#### Scenario: Kimi and OpenCode stream tools remain projected

- **WHEN** Kimi or OpenCode streams tool_calls / tool completion events
- **THEN** those events MUST continue to map to canvas tool items during the live turn
