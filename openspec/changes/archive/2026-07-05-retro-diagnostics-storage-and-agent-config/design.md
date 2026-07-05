## Context

记录 diagnostics storage isolation、diagnostics bundle、debug/kanban storage tests、Codex agents config、OpenSpec consistency script。

诊断数据和用户业务数据必须分层。AI 桌面客户端里 diagnostics 可能涉及错误、renderer 事件、运行时状态、导出包；如果边界不清，容易把 prompt、raw output、workspace file content 或 secrets 混进诊断包。

## Decisions

- Diagnostics storage 使用独立 schema/path boundary。
- Diagnostics bundle 不拉取无关用户内容。
- Agent config 属于 host adapter glue，不参与 app runtime product data。
- OpenSpec consistency script 属于 governance tooling。

## Risks And Guardrails

- 诊断包泄露敏感内容。
- 业务代码误依赖 `.codex/agents`。
- 防线：diagnostics export 审查 sensitive fields；runtime 不读取 agent config 作为事实源。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-diagnostics-storage-and-agent-config --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
