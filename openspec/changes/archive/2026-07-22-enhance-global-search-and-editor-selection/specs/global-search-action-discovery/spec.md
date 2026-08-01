## ADDED Requirements

### Requirement: Global Search MUST Discover And Execute Existing App Actions

系统 SHALL 在现有 global search palette 中提供 app action results，并 MUST 复用 action 对应的 existing handler，不得创建平行业务状态或重复副作用。

#### Scenario: User searches for a settings action
- **WHEN** 用户在 global search 输入“设置”或与 settings action 匹配的关键词
- **THEN** 结果 MUST 包含打开设置的 action
- **AND** 用户激活结果时 MUST 调用现有 settings open behavior

#### Scenario: User searches for common navigation and utility actions
- **WHEN** 用户搜索终端、Git、新建会话、最近活动、放大界面、缩小界面或重置界面
- **THEN** 系统 MUST 返回对应可用 action
- **AND** 激活结果 MUST 执行现有 navigation、session、terminal 或 UI scale handler

#### Scenario: Unknown action result is activated
- **WHEN** persisted recent data 引用了当前 registry 中不存在的 action id
- **THEN** 系统 MUST 忽略该 entry
- **AND** palette render 和 keyboard navigation MUST NOT throw

### Requirement: Searchable Navigation MUST Support Deterministic Fuzzy Matching

Action 与 file search SHALL 支持 case-insensitive exact、prefix、contiguous substring 与 subsequence fuzzy matching，并 MUST 使用确定性的 score 排序。

#### Scenario: Abbreviation matches a file component name
- **WHEN** 用户输入 `fvp`
- **AND** candidate path 或 basename 包含 `FileViewPanel`
- **THEN** file result MUST 被返回

#### Scenario: Stronger match ranks before a loose subsequence
- **WHEN** 两个 candidates 分别形成 exact/prefix match 与 loose subsequence match
- **THEN** exact/prefix candidate MUST 排在 loose subsequence candidate 前

#### Scenario: Path separators differ by platform
- **WHEN** file candidate 使用 POSIX `/` 或 Windows `\` path separator
- **THEN** fuzzy matching MUST 保持相同语义
- **AND** open target MUST 保留原始 path

### Requirement: Empty Global Search MUST Present Bounded Recent Discovery

Global search query 为空时 SHALL 显示 recent files、recent sessions 与 recent actions，并 MUST NOT 启动 message/history full-content search。

#### Scenario: Palette opens with an empty query
- **WHEN** 用户打开 global search 且没有输入 query
- **THEN** 系统 MUST 显示可用的 recent files、recent sessions 与 recent actions
- **AND** entries MUST 使用现有 file/session open behavior 与 action handler

#### Scenario: Recent action is recorded
- **WHEN** 用户从 global search 成功激活 registered action
- **THEN** 系统 MUST 记录该 action id 与执行时间
- **AND** persistence MUST 保持有界且 MUST NOT 保存 query、message、file content 或 terminal output

#### Scenario: Recent storage is unavailable or malformed
- **WHEN** client storage 不可用或 recent action payload 无效
- **THEN** 系统 MUST 回退为空 recent action list
- **AND** file/session search 与正常 action search MUST 保持可用

### Requirement: Search Hot Path MUST Remain Local-First And Bounded

Global search SHALL 保持 input keystroke local-first；fuzzy compute、recent projection 与 persistence MUST NOT 恢复 AppShell per-keystroke publication。

#### Scenario: User types rapidly in the palette
- **WHEN** 用户连续输入多个字符
- **THEN** input value MUST 在 palette leaf component 本地更新
- **AND** root-level search query publication MUST 保持 debounce/coalesced
- **AND** storage MUST NOT per-keystroke write

#### Scenario: Empty query is displayed
- **WHEN** palette 展示 recent discovery
- **THEN** recent projection MUST 使用 bounded sources
- **AND** message/history provider MUST NOT 因空 query 扫描全部内容
