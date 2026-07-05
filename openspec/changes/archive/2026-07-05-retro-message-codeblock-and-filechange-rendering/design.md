## Context

统一 code block language/copy affordance 与每文件 FileChangeRow 渲染，顺带收敛 Git diff/tool row 视觉。

代码块和文件变更是 AI coding transcript 的高价值信息。用户需要快速判断“这段代码是什么语言”“这个文件被怎么改了”“能否复制/审查”。如果每个 surface 自己渲染文件变更，消息、Composer、tool block、Git diff 会出现不同密度和不同语义。

## Decisions

- 代码块 affordance 是 presentation，不改变 Markdown AST。
- `FileChangeRow` 是 file-level evidence 的共享表示。
- Git diff command/data model 保持独立，只共享视觉 token。

## Risks And Guardrails

- 路径过长时可能压缩状态信息。
- 复制按钮可能遮挡代码内容。
- 防线：path/action/status/readability 都是验收点。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-message-codeblock-and-filechange-rendering --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
