## ADDED Requirements

### Requirement: Grok history tool_calls MUST preserve real tool names and arguments

When loading Grok `chat_history.jsonl`, the history reader MUST project each assistant `tool_calls` entry with the real tool name and parsed arguments. The reader MUST accept flat calls (`name` / `arguments` on the call object) and nested OpenAI-style calls (`function.name` / `function.arguments`). Only when neither name source is present MAY the reader fall back to a generic `tool` label.

#### Scenario: flat Grok 4.5 tool_calls

- **WHEN** an assistant history line contains `tool_calls` shaped as `{ "id", "name": "read_file", "arguments": "{...}" }`
- **THEN** the projected tool message MUST use `toolType`/`title` derived from `read_file`
- **AND** MUST parse JSON-string `arguments` into structured `toolInput` when valid JSON
- **AND** MUST NOT replace the name with generic `tool` solely because `function` is absent

#### Scenario: nested OpenAI-style tool_calls remain supported

- **WHEN** an assistant history line contains nested `function.name` / `function.arguments`
- **THEN** the projected tool message MUST use that nested name and arguments

#### Scenario: tool_result pairs to source call

- **WHEN** a `tool_result` line references `tool_call_id` matching a prior tool call id
- **THEN** the history projection MUST attach output to that source tool
- **AND** MUST NOT drop the source tool name when the source call is present

### Requirement: Projected Grok tools MUST enter shared canvas classification

After history projection, Grok tool items MUST be classifiable by shared tool semantics (`read` / `edit` / `bash` / `search` / hide). Known names including at least `read_file`, `list_dir`, `grep`, `run_terminal_command`, `search_replace` MUST NOT remain unknown generic presentation solely due to lost names.

Specialized snapshot types such as `commandExecution` and `fileChange` MUST use
exact known-name matching. A genuine unknown name MUST NOT be retyped solely
because it contains a keyword such as `command` or `write`.

#### Scenario: consecutive file reads group

- **WHEN** history contains two or more consecutive `read_file` (or equivalent read-classified) tool items
- **THEN** the canvas grouping layer MUST be able to form a read group

#### Scenario: terminal and search classify

- **WHEN** history contains `run_terminal_command` and `grep` tool items
- **THEN** they MUST classify as bash and search respectively

#### Scenario: todo tools stay hidden

- **WHEN** history contains `todo_write` / `TodoWrite` style tools
- **THEN** the canvas MUST continue to hide them per existing hide rules

#### Scenario: list_dir keeps directory identity

- **WHEN** history contains `list_dir` with `target_directory`
- **THEN** the read group MUST preserve and display that directory path
- **AND** MUST present the row action as `List`, not a pathless `Read`

#### Scenario: command-like unknown tool is not executable command

- **WHEN** history contains `get_command_or_subagent_output` with `task_ids` and
  `timeout_ms` but no executable command
- **THEN** projection MUST preserve `get_command_or_subagent_output` as the real name
- **AND** MUST NOT convert it to `commandExecution`
