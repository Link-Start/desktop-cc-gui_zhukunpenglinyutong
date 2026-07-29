## MODIFIED Requirements

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
