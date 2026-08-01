# messages-final-boundary-enforcement Specification

## Purpose
TBD - created by archiving change enforce-messages-final-boundaries. Update Purpose after archive.
## Requirements
### Requirement: External features cannot deep-import messages private modules

Code outside `src/features/messages` MUST import messages runtime surfaces only through `src/features/messages/index.ts` or an explicit neutral shared owner.

#### Scenario: external feature imports a private messages path

- **WHEN** composer、layout、threads or another external feature imports messages components、utils、rendering、rows、timeline、orchestration or another private path
- **THEN** `check:messages-boundaries` fails with the exact source and specifier

### Requirement: Messages internal dependency direction is enforced

Messages rows MUST NOT import timeline or orchestration owners. Timeline projection and virtualization MUST remain pure and MUST NOT import React component paths.

#### Scenario: row imports a controller owner

- **WHEN** a file under `messages/rows` imports a file under `messages/timeline` or `messages/orchestration`
- **THEN** the boundary checker fails independently of the exact debt baseline

#### Scenario: pure timeline layer imports a component

- **WHEN** a file under `messages/timeline/projection` or `messages/timeline/virtualization` imports a React component path
- **THEN** the boundary checker fails independently of the exact debt baseline

### Requirement: Threads cannot depend on messages private implementation

Threads code MUST NOT import messages components、utils、rendering、rows、timeline or orchestration paths.

#### Scenario: threads imports messages implementation

- **WHEN** a file under `src/features/threads` imports a forbidden messages private path
- **THEN** the boundary checker fails with a `threads -> messages private` diagnostic

### Requirement: Boundary enforcement is deterministic and active in CI

The checker MUST have fixture-based tests for all final rules and MUST run in the repository CI contract sequence.

#### Scenario: CI evaluates the final graph

- **WHEN** a pull request introduces a forbidden dependency edge
- **THEN** deterministic tests and `npm run check:messages-boundaries` fail before merge

