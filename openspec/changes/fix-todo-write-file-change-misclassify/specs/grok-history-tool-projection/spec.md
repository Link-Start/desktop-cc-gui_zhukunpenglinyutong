## MODIFIED Requirements

### Requirement: Projected Grok tools MUST enter shared canvas classification
After history projection, Grok tool items MUST be classifiable by shared tool semantics (`read` / `edit` / `bash` / `search` / hide). Known names including at least `read_file`, `list_dir`, `grep`, `run_terminal_command`, `search_replace` MUST NOT remain unknown generic presentation solely due to lost names.

Specialized snapshot types such as `commandExecution` and `fileChange` MUST use
exact known-name matching. A genuine unknown name MUST NOT be retyped solely
because it contains a keyword such as `command` or `write`.

The same exact-name rule SHALL apply to **live** Grok `todo_write` projection:
realtime MUST NOT retype `todo_write` as `fileChange` because the name contains
`write`.

#### Scenario: consecutive file reads group
- **WHEN** history contains two or more consecutive `read_file` (or equivalent read-classified) tool items
- **THEN** the canvas grouping layer MUST be able to form a read group

#### Scenario: terminal and search classify
- **WHEN** history contains `run_terminal_command` and `grep` tool items
- **THEN** they MUST classify as bash and search respectively

#### Scenario: todo tools stay hidden
- **WHEN** history contains `todo_write` / `TodoWrite` style tools
- **THEN** the canvas MUST continue to hide them per existing hide rules

#### Scenario: live todo_write is not a file edit
- **WHEN** a live Grok `todo_write` tool starts with `{ "todos": [...] }`
- **THEN** projection MUST keep the real name and the `todos` arguments
- **AND** MUST NOT convert it to `fileChange`

#### Scenario: list_dir keeps directory identity
- **WHEN** history contains `list_dir` with `target_directory`
- **THEN** the read group MUST preserve and display that directory path
- **AND** MUST present the row action as `List`, not a pathless `Read`

#### Scenario: command-like unknown tool is not executable command
- **WHEN** history contains `get_command_or_subagent_output` with `task_ids` and
  `timeout_ms` but no executable command
- **THEN** projection MUST preserve `get_command_or_subagent_output` as the real name
- **AND** MUST NOT convert it to `commandExecution`
