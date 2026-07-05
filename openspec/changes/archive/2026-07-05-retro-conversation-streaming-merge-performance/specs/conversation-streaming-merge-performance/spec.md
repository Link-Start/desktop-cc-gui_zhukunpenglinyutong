# Spec Delta: conversation-streaming-merge-performance

## ADDED Requirements

### Requirement: Streaming text merge MUST avoid full-history O(L2) work

Conversation reducer 和 message renderer SHALL 避免在每个 streaming token append 时扫描或重建完整 conversation history。

#### Scenario: 长回答流入

- **WHEN** 长回答流入
- **THEN** 当大量 assistant deltas 追加到 active turn 时，merge work 必须局限于 active target item 或 bounded live window，不能每 token 重扫全线程。

### Requirement: Heavy Markdown island detection MUST be skipped when unnecessary

Renderer SHALL 在 lightweight streaming 或 pure code-block content 不会改变 presentation 时跳过 heavy-island rescans。

#### Scenario: 轻量或纯代码流式内容

- **WHEN** 轻量或纯代码流式内容
- **THEN** 当 renderer 可判断 heavy-island analysis 不必要时，必须跳过该 render window 的 heavy analysis，并在 final settled render 保持 Markdown fidelity。
