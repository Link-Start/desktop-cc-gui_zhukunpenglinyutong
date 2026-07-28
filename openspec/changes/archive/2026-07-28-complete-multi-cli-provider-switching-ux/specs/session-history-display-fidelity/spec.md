## ADDED Requirements

### Requirement: Context Protocol Markers MUST Project As Human-Readable Continuation Context

Known Context Package and acceptance protocol entries MUST remain available to runtime persistence and recovery, but MUST NOT render as ordinary user/assistant messages or become session titles. The conversation surface MUST project the same facts through a human-readable continuation context card.

#### Scenario: native continuation history contains context protocol

- **WHEN** history contains a valid `MOSSX_NATIVE_CONTEXT_V1`, `MOSSX_CONTEXT_PACKAGE`, or `MOSSX_CONTEXT_ACCEPTED` control entry
- **THEN** the conversation surface MUST NOT render the raw protocol payload as an ordinary message
- **AND** MUST present a continuation context card derived from durable continuation metadata

#### Scenario: title fallback sees a context protocol prompt

- **WHEN** the first user history entry is a valid context protocol prompt
- **THEN** title normalization MUST ignore that entry as user intent
- **AND** MUST use continuation metadata or the next meaningful user intent

#### Scenario: ordinary user text mentions MOSSX

- **WHEN** an ordinary user message contains `MOSSX` but does not match a complete known control protocol grammar
- **THEN** the system MUST preserve and render that message
