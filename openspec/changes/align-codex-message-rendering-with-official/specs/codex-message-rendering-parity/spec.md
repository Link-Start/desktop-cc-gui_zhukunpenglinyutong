## ADDED Requirements

### Requirement: Codex assistant text MUST preserve upstream presentation intent

客户端 MUST 忠实渲染 Codex assistant message 的原始 Markdown，不得仅根据自然语言关键词注入额外 emoji、rail、背景或 font weight。

#### Scenario: verification progress remains plain text

- **WHEN** Codex assistant message 包含 `Focused tests 已通过。现在跑 TypeScript 检查。`
- **THEN** renderer MUST 展示原始文字
- **AND** renderer MUST NOT 自动插入 `✅`
- **AND** renderer MUST NOT 生成 keyword-derived lead rail 或 callout DOM

#### Scenario: next-step wording remains plain text

- **WHEN** Codex assistant message 以“下一步”或 `Next steps` 开头
- **THEN** renderer MUST NOT 自动插入 `🚀` 或其他 semantic marker
- **AND** paragraph hierarchy MUST 由原始 Markdown syntax 决定

### Requirement: Explicit Markdown content MUST remain backward compatible

移除 heuristic enhancement 后，renderer MUST 继续保留模型原文中显式存在的 Markdown 与 emoji。

#### Scenario: explicit emoji is preserved

- **WHEN** assistant 原文显式包含 `✅ 已完成`
- **THEN** renderer MUST 保留该 emoji
- **AND** MUST NOT 因移除 synthetic marker 而删除原始字符

#### Scenario: semantic Markdown remains functional

- **WHEN** assistant 原文包含 emphasis、inline code、list、table、blockquote 或 GitHub-style alert
- **THEN** renderer MUST 继续按对应 Markdown 语义渲染
- **AND** 本次 parity 调整 MUST NOT 降级现有 Markdown capability
