## ADDED Requirements

### Requirement: Shared realtime items MUST freeze execution target identity

When a Native runtime event is owner-routed into a Shared Session, every realtime assistant item for the active Turn MUST carry the immutable `activeTurnTarget` snapshot before entering the Conversation assembler. The renderer MUST NOT subscribe to or infer identity from the mutable Picker.

#### Scenario: realtime assistant displays target badge
- **WHEN** a Shared Turn is running and an assistant realtime item is normalized
- **THEN** the item MUST carry the active Turn's CLI, Provider, Model, and Reasoning snapshot
- **AND** the realtime Badge MUST match the later history Badge

#### Scenario: picker mutation cannot relabel active item
- **WHEN** the next-target Picker changes after a Turn snapshot is frozen
- **THEN** realtime items for the active Turn MUST retain the frozen snapshot
- **AND** MUST NOT read the new Picker value

### Requirement: Explicit local target MUST freeze disk Provider semantics

An Execution Target with no Provider Profile ID represents explicit local/default execution. At the send/freeze boundary, the system MUST persist `providerProfileSource = "disk"` and a readable local Provider name when those fields are absent. This normalization MUST NOT apply to legacy Turns whose execution target is unknown.

#### Scenario: new local Turn reloads as local configuration
- **WHEN** a new Shared Turn is sent with no Provider Profile ID
- **THEN** its frozen snapshot MUST identify disk/local Provider semantics
- **AND** realtime and history badges MUST display “本地配置” rather than “历史配置未知”

#### Scenario: unknown legacy identity remains unknown
- **WHEN** a legacy Turn lacks both explicit local/default semantics and Provider identity
- **THEN** history MUST keep the unknown-history label
- **AND** MUST NOT fabricate local Provider semantics
