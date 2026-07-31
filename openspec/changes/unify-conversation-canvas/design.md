## Context

事实源：`docs/analysis/conversation-canvas-structure-2026-07-31.md`、`docs/plans/2026-08-01-unified-conversation-canvas-architecture.md`。

三层「慢路径」曾混谈：

1. **对话级 lightweight**（摘要墙）— **删除**  
2. **行级 hydration summary**（详情已延迟条）— **删除呈现**  
3. **块级 Markdown/工具延迟**（显示详情）— **保留**

## Goals / Non-Goals

**Goals**

- 默认可读：助手正文与（有 L1 数据时的）工具卡不需点「渲染详情」。
- settle 锚点：贴底与上滚 ownership。
- 多 CLI 差异可查（矩阵/文档）。

**Non-Goals**

- Grok 协议补 tool 流（可文档 + 后续 change）。
- 块级显示详情删除。

## Decisions

### D1 — 对话级 lightweight 硬关

- `resolveConversationLightweightModeState` → 恒 `{ active: false, reason: "inactive" }`（或等价：`TIMELINE_ADAPTIVE` 下仍算 policy 但不激活 UI）。
- `ConversationLightweightPrompt` 不渲染（`visible` 恒 false 或组件短路）。
- oversized 不再自动开轻量。

### D2 — 行级 summary UI 移除

- `renderLightweightProjectionRow` 路径不可达：`shouldRenderLightweightSummary` 恒 false。
- hydration 可保留 internal `mode` 供虚拟化测量，但 **不得** 渲染「详情已延迟」条；屏外 heavy 行：保持 `hydrated` 或中性 placeholder（优先 **hydrated when virtualize off；virtualize on 时用高度占位无文案**，避免假摘要）。

**推荐实现（最小）**：

```text
shouldRenderLightweightSummary → always false
effectiveConversationLightweightMode → always false
detailHydrationRequested 可保留但无 UI 依赖
```

### D3 — 块级显示详情保留

- `markdownHeavyBlock*` / `toolHeavyDetail*` 逻辑与 i18n **不动主行为**。
- 测试不删除块级延迟用例。

### D4 — settle 锚点

- 用户 recent scroll intent → 不 re-arm autoScroll。
- turn-settle 预算内 bottom-distance 补偿。
- 与砍轻量后无 hydrate 阶跃联测。

### D5 — Live tool 水管（Grok / Kimi / OpenCode）→ 向 Claude 打磨看齐

- **Grok**：stdout 无 tool → `GrokToolHistoryTailState`：首开 **baseline=EOF**（P0 不重放旧 tool）+ **byte_offset 增量 tail**（P1）。
- **Kimi**：stream tool_calls；Completed 带 tool_name。
- **OpenCode**：stream Tool*，保持。
- **产品**：Grok/Kimi/OpenCode 与 Claude/Codex 一样 **幕布藏 bash/command/bashGroup**（读/写过程保留）。
- FE：mcpToolCall title 优先工具名；fileChange 归 fileEdit 场景。

## Risks

| 风险 | 缓解 |
|------|------|
| 长历史卡顿 | 尾窗 + 虚拟化回归；不重开 summary 墙 |
| 死代码残留 | grep 行级 lightweight UI 入口 |

## 实施阶段（无 commit）

1. Phase A：砍对话/行级轻量  
2. Phase B：settle 锚点  
3. Phase C：矩阵/文档 + 全量 focused 测试  

每阶段结束 **自审** 再进下一阶段。
