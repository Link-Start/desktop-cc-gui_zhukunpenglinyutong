## ADDED Requirements

### Requirement: Git changed-file surfaces share one renderer contract
主 Source Control、Git History worktree 与 commit details changed-file surfaces MUST 通过 canonical adapter 使用同一 flat/tree topology、file row 与 folder row renderer；页面容器 MUST NOT 维护等价的平行 row/tree JSX。

#### Scenario: Worktree surfaces render the same file model
- **WHEN** 主 Source Control 与 Git History worktree 展示同一组 staged/unstaged files
- **THEN** 两处 MUST 使用相同 status、path、folder、keyboard activation 与 collapse semantics

#### Scenario: Commit details uses read-only shared rows
- **WHEN** commit details 展示 historical changed files
- **THEN** 它 MUST 使用相同 shared renderer，并仅通过 adapter 禁用 worktree mutation actions

### Requirement: Shared changed-file renderer preserves domain actions
共享 renderer MUST 通过 typed callbacks/slots 接收 selection、inclusion、stage、unstage、discard 与 preview commands，且 MUST NOT 自行执行 Git service calls。

#### Scenario: Worktree action remains scoped
- **WHEN** 用户在 shared row 点击 stage、unstage、discard 或 inclusion control
- **THEN** renderer MUST 调用所属页面注入的 command，并阻止 row activation 抢占该 action
