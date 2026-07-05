## Context

记录消除 O(L^2) streaming merge、减少长对话全历史渲染、跳过不必要 heavy-islands 扫描的性能事实。

长回答流式输出时，最危险的性能反模式是每个 token 都重新扫描或重建整段历史。短内容看不出来，长内容会变成累计 O(L^2)，主线程被压死，用户看到卡顿、输入延迟、scroll lag。

## Decisions

- Streaming merge 应只触达 active target item 或 bounded live window。
- Final render 可以恢复 full fidelity，但 streaming render 必须 bounded。
- Heavy analysis 只有会影响 presentation 时才运行。

## Risks And Guardrails

- 为了修 UI 再次引入 full transcript scan。
- 跳过 heavy-island 误伤 final fidelity。
- 防线：streaming path 和 settled path 分开验证。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-conversation-streaming-merge-performance --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
