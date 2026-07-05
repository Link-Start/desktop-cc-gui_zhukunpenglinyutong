## Context

记录 per-engine composer preferences、ClaudeContextCard、ai-elements context usage indicator 的既成事实。

多引擎客户端不能把 Composer 的 model/effort/permission/plan mode 当成全局单值。Claude、Codex 等 engine 的默认模型和授权策略不同，用户在一个 engine 上的选择不应悄悄覆盖另一个 engine。

## Decisions

- Composer preferences 以 engine scope 存储。
- Context indicator 只能从 typed usage/model facts 派生。
- Presentation component 不应伪造 confirmed usage。

## Risks And Guardrails

- 不同 engine 偏好互相覆盖会造成错误模型提交。
- Context indicator 如果把 estimated 当 confirmed，会误导用户。
- 防线：偏好写入必须 scoped，usage state 必须显式区分。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-composer-engine-preferences-and-context-indicator --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
