## ADDED Requirements

### Requirement: Live auto-follow re-enable MUST re-arm the current viewport

When the user re-enables live auto-follow during an active message canvas run, the system MUST treat that action as an explicit request to return the current message viewport to the latest output and resume bottom-follow.

#### Scenario: re-enable focus follow returns to latest output
- **WHEN** a live conversation is processing
- **AND** the user has scrolled away from the bottom so automatic following is paused
- **AND** the user re-enables the focus-follow live canvas control
- **THEN** the message viewport MUST scroll to the bottom sentinel
- **AND** later live output MUST be allowed to continue bottom-following

#### Scenario: manual scroll pause remains respected until explicit re-enable
- **WHEN** a live conversation is processing
- **AND** the user scrolls away from the bottom
- **THEN** automatic bottom-follow MUST pause
- **AND** the viewport MUST NOT be forced back to the bottom unless the user returns to the bottom or explicitly re-enables focus follow

#### Scenario: static history updates do not become live auto-follow
- **WHEN** no conversation turn is actively processing or finalizing
- **AND** static history rows change
- **THEN** the focus-follow control MUST NOT cause an unrelated automatic scroll to the bottom
