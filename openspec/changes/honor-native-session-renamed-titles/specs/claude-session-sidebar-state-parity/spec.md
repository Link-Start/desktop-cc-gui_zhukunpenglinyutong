## MODIFIED Requirements

### Requirement: Claude Sidebar Titles MUST Preserve Stable User-Facing Identity

Claude sidebar title projection MUST prevent weaker generic fallback names from overwriting stable mapped, custom, native custom-title, or previously meaningful session titles. Session JSONL 中最后一个有效 `custom-title.customTitle` MUST 作为 native catalog title，并保持低于 GUI mapped/custom title、高于 first-message fallback 的 precedence。

#### Scenario: generic fallback does not overwrite mapped title
- **WHEN** a Claude session has a mapped or custom title
- **AND** a later refresh can only derive a generic title such as `Claude Session` or `Agent N`
- **THEN** the sidebar MUST keep the mapped or custom title
- **AND** the weaker fallback MUST NOT replace it

#### Scenario: existing meaningful title survives lower-confidence refresh
- **WHEN** a Claude sidebar row already has a meaningful non-generic title
- **AND** a later degraded refresh has the same session identity but only a first-message or generic fallback title
- **THEN** the sidebar MUST preserve the meaningful title unless a mapped/custom title or stronger native title is available

#### Scenario: native Claude custom title replaces first-message preview
- **WHEN** a Claude session JSONL contains one or more valid `type = "custom-title"` records
- **THEN** backend catalog `title` 与 optional `nativeTitle` MUST 使用最后一个 trim 后非空的 `customTitle`
- **AND** first-message preview MUST NOT 覆盖该 native title

#### Scenario: weak-looking native Claude rename remains authoritative
- **WHEN** 有效 `customTitle` 恰好为 `Agent 12`、`Claude Session` 或短 hexadecimal string
- **THEN** frontend MUST 依据 `nativeTitle` 显示该名称
- **AND** fallback title-strength heuristic MUST NOT 保留旧 first-message title

#### Scenario: invalid Claude custom title preserves fallback
- **WHEN** a Claude session has no custom-title, or custom-title records are malformed or blank
- **THEN** the session MUST continue using its existing first-message / generic fallback
- **AND** invalid title metadata MUST NOT change message count、workspace attribution 或 session visibility
