# session-history-display-fidelity Specification

## Purpose

定义 session title、command prompt 与参数在 sidebar/history projection 中的展示保真。

## Requirements

### Requirement: Session rows preserve meaningful titles

Session sidebar/history projection MUST 优先展示可用的 explicit title，并在 fallback 时使用规范化 user intent，而不得显示内部 command wrapper 或无意义空标题。

#### Scenario: Display a session with an explicit title

- **WHEN** history entry 提供非空 session title
- **THEN** session row MUST 展示该 title，并保持 engine/provider metadata 可辨识

#### Scenario: Build a title from user intent

- **WHEN** explicit title 不存在但首条用户 intent 可用
- **THEN** fallback title MUST 使用去除内部 wrapper 后的可读 intent

### Requirement: Slash-command prompts retain arguments in history

History normalization MUST 保留用户输入的 slash command 及其 arguments，不得因识别 command marker 而丢弃整条 user prompt。

#### Scenario: Reopen a slash-command session

- **WHEN** 历史 user message 为带 arguments 的 slash command
- **THEN** reopened transcript 与 session display MUST 保留 command 和 arguments

### Requirement: Context Protocol Markers MUST Project As Human-Readable Continuation Context

Known Context Package and acceptance protocol entries MUST remain available to runtime persistence and recovery, but the complete bootstrap control exchange—including associated user entry, assistant reply, reasoning, lifecycle state, and marker—MUST NOT render as ordinary conversation content or become session titles. The conversation surface MUST project the same durable facts through a compact continuation metadata row inside the existing message scroll flow.

#### Scenario: native continuation history contains context protocol

- **WHEN** history contains a valid `MOSSX_NATIVE_CONTEXT_V1`, `MOSSX_CONTEXT_PACKAGE`, or `MOSSX_CONTEXT_ACCEPTED` control exchange associated with durable continuation metadata
- **THEN** the conversation surface MUST NOT render any part of that control exchange as an ordinary message or reasoning item
- **AND** MUST present a compact, default-collapsed continuation metadata row derived from durable continuation metadata

#### Scenario: bootstrap lifecycle settles

- **WHEN** bootstrap delivery emits runtime processing or terminal events
- **THEN** those lifecycle events MUST NOT keep the target conversation in ordinary user-Turn processing state
- **AND** the first real user Turn MUST start and settle independently

#### Scenario: title fallback sees a context protocol prompt

- **WHEN** the first user history entry is a valid context protocol prompt
- **THEN** title normalization MUST ignore the complete bootstrap exchange as user intent
- **AND** MUST use continuation metadata or the next meaningful user intent

#### Scenario: ordinary user text mentions MOSSX

- **WHEN** an ordinary user message contains `MOSSX` but does not match a complete known control protocol grammar and continuation identity
- **THEN** the system MUST preserve and render that message
