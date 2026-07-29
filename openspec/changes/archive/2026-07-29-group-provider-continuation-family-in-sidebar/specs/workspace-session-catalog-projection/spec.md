## ADDED Requirements

### Requirement: Conversation Family MAY Form A Presentation-Only Sidebar Group

Sidebar MUST be allowed to place visible top-level Sessions with the same authoritative `familyId` into one contiguous presentation group while preserving every member as an independent top-level Session. The presentation group MUST NOT create runtime ownership, change canonical identity, or reuse Subagent tree semantics.

#### Scenario: visible continuation family becomes contiguous

- **WHEN** one Sidebar scope contains at least two visible top-level Sessions with the same authoritative `familyId`
- **AND** at least one member is explicitly a `provider-continuation`
- **THEN** the projection MUST place those visible Family members contiguously
- **AND** it MUST preserve their existing relative order inside the Family block
- **AND** the block MUST occupy the position of its first visible member in the original list

#### Scenario: legacy source without family metadata joins its continuations

- **WHEN** visible Provider Continuations share an authoritative `familyId`
- **AND** their `sourceSessionId`, `lineageParentSessionId`, or `familyRootSessionId` exactly matches a visible legacy source Session canonical id in the same Sidebar partition
- **AND** the source Session does not carry its own `familyId`
- **THEN** the projection MUST include that source root block in the same presentation group
- **AND** the visible member count MUST include the source Session
- **AND** it MUST preserve the source Session's independent top-level identity

#### Scenario: ambiguous source claim fails open

- **WHEN** one visible source Session without `familyId` is claimed by more than one distinct authoritative Family
- **THEN** the projection MUST leave that source outside all Family boundaries
- **AND** it MUST NOT resolve the conflict using title, timestamp, Provider, content, prefix, or proximity

#### Scenario: family grouping preserves top-level identity

- **WHEN** a source Session and its Provider Continuations are visually grouped
- **THEN** every member MUST remain independently selectable, restorable, pinnable, and addressable by its own canonical identity
- **AND** no member MUST gain `parentThreadId`, Subagent depth, tree expander, `aria-expanded`, or a `子代理` label because of the grouping

#### Scenario: subagent subtree remains atomic

- **WHEN** a Family member also owns visible runtime Subagent descendants
- **THEN** the member and its existing Subagent subtree MUST move as one root block during Family ordering
- **AND** the Subagent descendants MUST retain their existing ownership, depth, identity, and collapse behavior
- **AND** the Family member count MUST count only top-level Family Sessions

#### Scenario: uncertain family metadata fails open

- **WHEN** fewer than two visible members can be established by a shared authoritative `familyId` or an exact authoritative source/lineage reference
- **OR** a candidate contains an unsupported non-empty `lineageKind`
- **THEN** Sidebar MUST keep the affected rows in their ordinary top-level projection
- **AND** it MUST NOT infer grouping from title, timestamp, Provider, content, or proximity

#### Scenario: projection respects list partitions

- **WHEN** related Sessions are separated by workspace, worktree, session folder, pinned state, visibility filter, or unloaded pagination
- **THEN** grouping MUST operate only on the members visible inside each current list partition
- **AND** it MUST NOT move a row across those boundaries
