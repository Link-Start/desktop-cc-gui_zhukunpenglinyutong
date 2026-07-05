## Context

把 Bash/Edit/Read/Search/MCP/Generic tool blocks 收敛到共享 ToolMarkerShell，并修复虚拟空行布局问题。

AI 编码客户端里，tool block 不是装饰卡片，而是用户判断 AI 是否读文件、改文件、跑命令、调用 MCP 的证据面。之前每类 tool block 各自维护外壳，尺寸、折叠、状态表达容易分叉。

## Decisions

- Tool-specific body 留在各 tool block，common chrome 进入 `ToolMarkerShell`。
- 折叠只是 presentation state，不得删除 evidence payload。
- Timeline measurement 不应被 placeholder row 和 tool shell 样式互相污染。

## Risks And Guardrails

- 过度折叠会降低审计能力。
- 统一外壳若吞掉 tool-specific 状态，会导致 Bash/Edit/Read 等语义丢失。
- 防线：新增 tool block 必须提供 summary、status、details 三层信息。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-message-tool-marker-shell --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
