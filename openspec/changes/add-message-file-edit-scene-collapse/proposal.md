> **Status (2026-07-31):** Absorbed by `repair-grok-canvas-tools-and-file-edit-collapse`.
> UI for default-collapsed file-edit scenes largely landed in tree; remaining verification,
> main-spec sync, and Grok history tool grouping that makes this shell useful for Grok
> sessions are owned by the absorbing change. Do not implement in parallel.

## Why

对话幕布里，两个助手正文段落之间的文件修改目前会按文件逐条展开（`editGroup` → `EditToolGroupBlock` 默认 `isExpanded=true`；单文件 `fileChange`/`edit` 工具行也常直接露出 path + diff 摘要）。文件数量一多，正文阅读被连续编辑卡片打断，关注点被工具噪音稀释。

已有折叠外壳（`ToolMarkerShell`）和分组逻辑（`groupToolItems` 的 `editGroup`），但默认展开、折叠态信息密度仍偏高（图标 + 标题 + 计数 + +/- + chevron + 边框展开体），缺少「场景级只露一行标题、按需展开详情」的极简 contract。现在补齐该能力，可以立刻降低幕布视觉中断，而不改动 file-change 事实抽取或跨 surface 归一化。

## 目标与边界

- 每个「文件修改场景」（timeline 上连续的 `editGroup`，以及可并入同场景的相邻 edit/fileChange 工具块）提供独立可折叠能力。
- 默认折叠，折叠态仅展示极简触发器：`icon + 文案「文件修改（N 个）」`（i18n 可本地化），不展示文件列表与边框容器。
- 展开态展示该场景下既有文件编辑项 UI（复用 `FileChangeRow` / 现有 path、status、+/-、diff 预览能力），内容无损。
- 点击标题区域切换展开/折叠；支持键盘 Enter/Space；`aria-expanded` 语义完整。
- 多场景互不干扰；展开/折叠状态以稳定 scene key 绑定，禁止用临时数组 index。
- 动画建议 160ms（范围 120–200ms），并兼容 `prefers-reduced-motion`。
- 本期状态优先会话内 local UI state；持久化（按 `sessionId/docId + sceneId`）列为可选后续，不阻塞 MVP。

## 非目标

- 不重做 `TurnFilesChangedCard` 回合汇总卡、右侧 session activity、底部 status panel 的折叠策略（它们可后续对齐，但不在本期范围）。
- 不改变 `groupToolItems` 的分类算法与 file-change 事实源（`item.changes[]`、canonical entry 口径）。
- 不改 write/edit 工具的审批流、打开 diff/path 的 handler 语义、或 diff 计算逻辑。
- 不引入新 backend command、IPC、storage schema（MVP 无持久化时）。
- 不做全局「默认展开/折叠」设置页配置（可在 design 中预留 `defaultCollapsed` prop，本期硬编码默认折叠即可）。
- 不把 read/search/bash 等其他 tool group 一并改成同一视觉（仅文件修改场景）。

## What Changes

- 为幕布内文件修改场景建立 **scene-level collapse** presentation contract：
  - `sceneId`：稳定身份（优先 first tool item id / group key，而非 render index）
  - `fileCount`：场景内可展示文件数
  - `collapsed` / `expanded`：本地 UI 状态
- 调整 `EditToolGroupBlock`（及必要时单文件 edit/fileChange 在场景中的包装）默认折叠；折叠态文案对齐「文件修改（N 个）」。
- 折叠态视觉对齐极简无边框参考（`+/-` 或细 caret + 文案；去掉厚边框卡片感）；展开态列表可无块级边框，保持与幕布正文节奏一致。
- 保持展开后每文件 row 的 path / action / status / +/- / 可选 diff 预览与现有 `FileChangeRow` 行为一致。
- 补充 focused Vitest：默认折叠、toggle、多场景独立、0/1/多文件、键盘可达、快速点击不丢状态。
- 可选：埋点 `file_edit_collapse_toggle`（若现有 analytics 基建可接；无基建则跳过，不造新 telemetry 栈）。

## 技术方案比较

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **A. 复用 `ToolMarkerShell`，改默认折叠 + 文案/样式** | 在现有 `EditToolGroupBlock` 上把 `useState(true)` 改为默认折叠，精简 header children，展开体去重边框 | 改动面小；沿用 Marker 键盘/点击/chevron 基建；与 Explore/Bash 组风格一致 | 与「极简无边框」参考稿仍有 Marker 行高/icon 体系差异 | **MVP 推荐**：先交付行为与密度，视觉在现有 shell 内收敛 |
| **B. 新增 `FileEditCollapsible` 独立组件** | 按参考 HTML 的 `details/summary` 语义自建极简 header，包住现有 file list | 视觉最接近参考稿；职责边界清晰 | 与 `ToolMarkerShell` 双轨；键盘/a11y/主题 token 要重做一遍 | 若 A 无法达到可读密度目标，design 阶段可升级到 B |
| **C. 持久化每个 scene 折叠偏好** | localStorage / client store by `sessionId + sceneId` | 长会话返回可恢复 | storage 清理、scene 身份漂移、跨会话噪声 | **本期不做**；design 预留接口 |

采用 **方案 A** 作为实现基线；验收以「默认折叠 + 场景独立 + 内容无损」为准，不以像素级复刻 HTML demo 为硬门禁。

## Capabilities

### New Capabilities

- `message-file-edit-scene-collapse`：定义对话幕布内「文件修改场景」的默认折叠、折叠态最小展示、展开态完整文件列表、场景级状态隔离与无障碍切换 contract。

### Modified Capabilities

- `message-codeblock-filechange-rendering`：补充「多文件变更可被场景级折叠容器承载」的呈现要求——折叠态允许只显示场景摘要行，展开后仍须满足既有 per-file row 可读性要求（path、action、status）。

## 验收标准

- 含文件修改的场景首帧默认折叠，仅见 icon +「文件修改（N 个）」（或等价 i18n），不见文件列表。
- 点击 / Enter / Space 可稳定切换；`aria-expanded` 与可见状态一致。
- 同一幕布内多个文件修改场景状态互不影响。
- 展开后列表完整：路径、状态、增删统计、既有 diff 预览/打开能力与改前一致。
- 回归：0 文件（不渲染或空安全）、1 文件、多文件、streaming 中文件数增长、快速连点、窄宽布局不错位。
- `prefers-reduced-motion: reduce` 时无强制过渡动画。
- focused Vitest + `npm run typecheck` 通过。

## Impact

- **Frontend**
  - `src/features/messages/components/toolBlocks/EditToolGroupBlock.tsx`（默认折叠、header 文案/密度）
  - 可能触达：`ToolMarkerShell.tsx` / Marker 样式、`TimelineRowRenderer.tsx`（若需 scene key 透传）
  - 可能触达：单文件 edit/fileChange 渲染路径（若 1 文件也需统一场景折叠）
  - i18n：`src/i18n/locales/*/tools.ts` 或 `messages.ts`（「文件修改（N 个）」）
  - Tests：`EditToolGroupBlock` / rich-content / groupToolItems 相关 Vitest
- **Spec**：新 capability delta + `message-codeblock-filechange-rendering` delta
- **Backend / API / storage / dependency**：无（MVP）

## 风险与应对

| 风险 | 应对 |
|------|------|
| 折叠态误触导致文件行误点 | 点击目标仅限 header；展开体与 header 留足间距 |
| 用 index 作 key 导致状态串场景 | 强制 `sceneId` = first item id 或稳定 group key |
| 默认折叠后用户找不到刚改的文件 | 折叠态明确显示 N；live 增长时可保持当前 expanded 不变（不因 count 变化自动收起） |
| 动画影响可读性 | 160ms 默认 + `prefers-reduced-motion` 关闭动画 |
| 与 `TurnFilesChangedCard` 信息重复 | 本期不合并两套 surface；汇总卡仍在 turn 边界，场景折叠只管幕布中间工具块 |

## 参考输入（外部设计稿）

本提案吸收以下内容分析产物的产品意图与极简视觉方向（实现落点已映射到 mossx 幕布组件，而非外部「幕布产品」代码）：

- 需求：`file-edit-collapse-proposal.md`（场景折叠、默认折叠、文案、状态、验收）
- 视觉参考：`file-edit-collapse-variants.html`（极简无边框、`icon + 文件修改（N 个）`、独立 details 场景）

## 交付顺序（后续 artifact）

1. **design.md**：sceneId 生成规则、默认折叠策略、与 `ToolMarkerShell` 的 API 贴合、streaming 时 expanded 保持规则、是否包装单文件路径  
2. **specs/**：`message-file-edit-scene-collapse` + `message-codeblock-filechange-rendering` delta  
3. **tasks.md**：实现与测试勾选清单  
4. 实现后 verify / 按需 sync-specs / archive  
