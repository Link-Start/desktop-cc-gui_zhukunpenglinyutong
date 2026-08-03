## 1. OpenSpec

- [x] 1.1 proposal / design / specs / tasks（块级显示详情保留）
- [x] 1.2 `openspec validate unify-conversation-canvas --strict`

## 2. Phase A — 砍对话/行级轻量（保留块级）

- [x] 2.1 对话级 lightweight 恒 inactive；policy 不建议
- [x] 2.2 行级 lightweight 摘要条路径恒 false；hydration 不再 mode=summary
- [x] 2.3 更新 lightweight/hydration 单元测试；块级 i18n/UI 保留
- [x] 2.4 Phase A self-review

## 3. Phase B — settle 锚点

- [x] 3.1 审 scroll controller：turn-settle **有意 re-pin**（流式上滚后结束贴底）— 与现有 live-behavior 测试一致，**不**改为「上滚不拽回」
- [x] 3.2 live-behavior settle 用例通过（64）
- [x] 3.3 Phase B self-review：注释固化契约，避免再次误改 ownership

## 4. Phase C — 矩阵/文档

- [x] 4.1 analysis §7.2 对话/行级标下线；块级保留；settle 症状表更新
- [x] 4.2 plan D2 块级保留；OpenSpec design 一致
- [x] 4.3 focused Vitest + validate；**不 commit**（用户约束）

## 5. Phase D — Live tool 水管（Grok / Kimi / OpenCode）

- [x] 5.1 Grok：chat_history.jsonl 轮询桥接 ToolStarted/Completed（stdout 无 tool 事件）
- [x] 5.2 Kimi：ToolCompleted 携带 tool_name（便于幕布归类）
- [x] 5.3 事件映射：write/edit 类 → fileChange；mcpToolCall title 优先工具名
- [x] 5.4 OpenCode：已有 live Tool* emit，确认 forwarder 路径（不改协议）
- [x] 5.5 单元测试 drain tool signals；**不 commit**

## 6. Phase E — 对齐 Claude 打磨 + 硬化

- [x] 6.1 P0：本 turn baseline offset（resume 不重放旧 tool）
- [x] 6.2 P1：增量 tail（byte_offset + 行 carry）
- [x] 6.3 产品：Grok/Kimi/OpenCode 幕布 **藏 bash/command**（与 Claude/Codex 一致）
- [x] 6.4 P2：ConversationLightweightPrompt 死 UI 短路
- [x] 6.5 能力矩阵文档：`docs/analysis/canvas-live-tool-projection-matrix-2026-08-01.md`
- [x] 6.6 手测清单写入矩阵文档；**不 commit**
