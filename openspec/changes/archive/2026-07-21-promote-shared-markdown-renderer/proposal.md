## Why

Markdown 已被 composer、git、context-ledger、note-cards、project-memory、session-activity、spec
和 update 等 feature 复用，但 owner 仍在 `messages/components/Markdown`，且 runtime/support modules
分散在 messages private paths。该反向依赖阻碍最终 boundary gate，也让 streaming、local resource、
heavy islands 和 lazy runtime contract 难以作为 shared capability 独立演进。

## What Changes

- 将 Markdown implementation、runtime/support modules 与 shared tests 移到 `src/markdown/**`。
- 提取 pure local resource normalization、heavy-island predicates 和 streaming value hook。
- messages 旧路径保留 compatibility re-export；所有 runtime callers 改用 canonical owner。
- 保持 local file/image、math、Mermaid、tool-call XML、outline、fullscreen、lazy chunk 与 worker behavior。

## 验收标准

- `src/markdown/**` 不 import messages private path。
- 外部 feature 不再 import `messages/components/Markdown` 或 messages markdown runtime/helper。
- focused Markdown/external smoke、messages、typecheck、build、worker、bundle、boundary gates 通过。
