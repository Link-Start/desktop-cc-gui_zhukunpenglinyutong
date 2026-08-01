## Decisions

### Canonical owner

`src/markdown/components/Markdown.tsx` 是唯一 implementation owner；旧 messages component 是一行
re-export。与 Markdown 共同演进的 Full/Live runtime、Mermaid、ToolCall、code helpers、normalizers 与
outline/tool-call parsers 一并迁入 `src/markdown/**`，避免 shared owner 反向依赖 messages。

### Pure presentation helpers

`markdownLocalResources.ts` 负责 local image/file/resource token normalization；
`markdownHeavyIslands.ts` 负责 heavy code/table predicates。两者不 import React。

### Streaming owner

`useMarkdownStreamingValue` 接受 value、throttle/progressive policy，独占 timers、cleanup 与 rendered value
推进；Markdown 只组合 hook 输出。保持现有 scheduling thresholds 与 callback timing。

### Compatibility and lazy boundaries

先移动 implementation，保持原 lazy `FullMarkdownRuntime`/`MermaidBlock` 入口及 chunk semantics；再迁移
callers/tests。禁止在本 change 改 DOM、CSS class、translation、URL transform 或 Markdown policy。

## Risks / Mitigations

- relative import drift：迁移后用 typecheck、all Markdown tests 和 production build 验证。
- lazy chunk eager loading：保留 dynamic import，并运行 lazy-runtime/bundle/worker gates。
- timer cleanup drift：先提取现有 scheduler tests/behavior，再切换 hook owner。
