## MODIFIED Requirements

### Requirement: File Editor MUST Retain Scoped Cross-File Semantic Navigation History

File Editor MUST retain an ordered, in-memory history for cross-file locations reached through definition、implementation 或 references navigation，并 MUST preserve the cursor and vertical viewport snapshot associated with each history location。

#### Scenario: Traverse a semantic navigation chain backward and forward

- **GIVEN** 用户依次从 `A` semantic navigate 到 `B`，再从 `B` navigate 到 `C`
- **WHEN** 用户连续触发 Back
- **THEN** File Editor MUST 依次恢复离开 `B` 与 `A` 时的 file、line、column 与 vertical scroll offset
- **AND** subsequent Forward MUST 依次恢复离开 `B` 与 `C` 时的最新 snapshot

#### Scenario: History traversal snapshots the location being left

- **GIVEN** 用户通过 semantic navigation 到达 target file 后移动 cursor 并滚动 viewport
- **WHEN** 用户触发 Back 或 Forward 离开该 file
- **THEN** File Editor MUST 在 traversal 前刷新当前 history entry
- **AND** later traversal 回到该 entry 时 MUST restore the refreshed cursor and vertical scroll offset

#### Scenario: New semantic jump truncates the forward branch

- **GIVEN** history 为 `A -> B -> C` 且用户已 Back 到 `B`
- **WHEN** 用户从 `B` semantic navigate 到 `D`
- **THEN** history MUST 收敛为 `A -> B -> D`
- **AND** `C` MUST NOT remain reachable through Forward
- **AND** `B` MUST retain the cursor and vertical scroll offset captured immediately before the jump to `D`

#### Scenario: Same-file semantic positioning does not create history

- **WHEN** definition、implementation 或 references navigation target 与 source 属于同一 file
- **THEN** File Editor MUST perform the existing positioning behavior
- **AND** MUST NOT append a cross-file history entry

#### Scenario: Restored viewport belongs only to semantic history traversal

- **WHEN** file tree、global search、manual tab activation 或 ordinary file open changes the active file
- **THEN** File Editor MUST NOT apply a pending semantic-history viewport snapshot to that file
- **AND** existing manual navigation isolation MUST remain intact
