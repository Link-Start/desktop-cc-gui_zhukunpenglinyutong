## Context

Codex 原始 session record 中，截图对应的 commentary 文本是 `Focused tests 已通过。现在跑 TypeScript 检查。`，不包含 `✅`、blockquote marker 或其他视觉指令。当前客户端在 `Markdown.tsx` 中启用 `markdown-codex-canvas` 后，会调用 `detectCodexLeadMarker`，把包含“测试/检查”等词的普通 paragraph 改写成 `.markdown-lead-verify`，并插入 `✅`。对应 CSS 再增加左侧 rail、背景和 font weight。

因此差异来自客户端 presentation heuristic，而不是 Codex 上游输出。

## Goals

- 与官方 Codex 的 plain commentary presentation 对齐。
- 保留 Markdown renderer 的真实语义能力与 streaming performance contract。
- 通过删除而非新增 abstraction 完成修复。

## Non-Goals

- 本次不新增 `commentary | final_answer` message phase 到 `ConversationItem`。
- 本次不重做消息分组、工具卡片或 final answer hierarchy。
- 本次不改变用户主动写入的 emoji 或 Markdown syntax。

## Decision

选择删除 `Codex lead enhancement`：

1. `Markdown` 不再因 `markdown-codex-canvas` 覆盖 paragraph renderer。
2. `MessagesRows` 不再为 Codex assistant 注入仅用于该 heuristic 的 class。
3. 删除 `codexLeadMarkers.ts` 与 `.markdown-lead-*` CSS。
4. presentation profile 中的 `codexCanvasMarkdown` 字段暂时保留，避免扩大 cross-layer contract；它仍可用于 Codex-specific streaming strategy，但不再改变正文 DOM。

## Alternatives Considered

- **仅减淡 rail/emoji**：仍然会改写模型原文，无法真正实现官方 parity，拒绝。
- **只对 commentary 禁用，final answer 保留**：当前 message model 未保存 Codex `phase`，需要扩大 realtime/history/type contract；对本次视觉问题不是最小修复，暂不采用。
- **增加用户设置开关**：引入额外配置和迁移成本，而用户诉求与官方行为都指向默认精简，拒绝。

## Verification

- RED test 证明当前 Codex message 会生成 `.markdown-lead-*` 与 synthetic emoji。
- GREEN test 证明相同原文只渲染原始文字，不出现 synthetic emoji/rail class。
- 证明显式输入的 emoji 仍保留。
- 运行 focused Vitest、`npm run typecheck`、targeted ESLint、OpenSpec strict validation。
- 启动本地 UI 并对照官方截图执行 visual verdict，目标 score ≥ 90。
