## Why

多 CLI 共用一套 Messages 核，但体验不统一：Grok 实时无 tool 行、回合结束锚点漂移、对话级/行级「详情已延迟 + 渲染详情」把正文藏成摘要墙。需要统一呈现契约：默认可读、锚点可信、引擎差异可查；并按产品决策砍掉轻量摘要墙（保留块级「显示详情」）。

## 目标与边界

- **一核呈现**：继续 `Messages → Timeline → Row`，不拆多套幕布。
- **砍掉对话级 + 行级轻量极简化**：无 `ConversationLightweightPrompt` 主路径；无行级「详情已延迟 / 渲染详情」摘要条；无 oversized 自动摘要墙。
- **保留块级「显示详情」**：重型 Markdown 岛 / 工具重型 output 的延迟+显示详情可保留。
- **修好回合结束锚点**：settle-repin 贴底与用户上滚 ownership 清晰。
- **多 CLI 能力可查**：登记 live/history tool 投影差异（含 Grok 协议无 live tool）。
- 性能靠尾窗 + 闲时虚拟化 + live-text + 块级延迟，不靠行级假摘要。

## 非目标

- 不为每 CLI 拆 Messages 树。
- 不伪造 Grok live tool 卡（无协议事件时不编造）。
- 不默认打开 streaming 虚拟化。
- 不改 fileEdit 场景默认折叠产品意图。
- 本 change **期间不要求 git commit**（用户约束）；实现与验证在工作树完成即可。

## What Changes

- 关闭/移除对话级 lightweight 策略与 UI。
- hydration 行级 `mode=summary` 不再以「详情已延迟」摘要条呈现；屏外可用中性占位或保持 hydrated 策略（design 定夺）。
- 块级 markdown/tool heavy「显示详情」**保留**。
- settle 滚动 ownership 与高度阶跃补偿加固。
- 文档/矩阵：canvas liveToolProjection 等；analysis §7.2 标为 removed（对话/行级）。
- 测试：轻量路径删除或改写；settle 回归。

### 方案对比

- **A. 只改默认开关仍保留代码**：易回潮。拒绝主路径。
- **B. 砍对话+行级轻量，保留块级延迟 + 尾窗/虚拟化**（采用）。
- **C. 连块级也砍**：用户已要求保留块级。不采用。

## Capabilities

### New Capabilities

- `conversation-canvas-unified-presentation`：统一幕布默认可读、轻量摘要墙禁用、块级延迟允许、settle 锚点契约。

### Modified Capabilities

（若实现触及既有 curtain 契约，在 apply 时补 delta；本阶段以新 capability 承载。）

## Impact

- Frontend messages timeline / lightweight / hydration / scroll controller。
- Docs：analysis + plan。
- Tests：lightweight / hydration / settle 相关 Vitest。
- 无 DB / 无新 IPC。

## 验收标准

1. 无对话级/行级「详情已延迟」「渲染详情」「启用轻量模式」主路径。
2. 块级「显示详情」仍可用。
3. 回合结束贴底阅读稳定；用户上滚不被错误拽回。
4. Grok live 无 tool 在矩阵/文档可解释。
5. 流式尾窗与闲时虚拟化仍工作。
